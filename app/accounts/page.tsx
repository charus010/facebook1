"use client";
import { useState } from "react";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { Button, ConfirmModal, EmptyState, Field, Input, Modal, PageHeader, PageSkeleton, StatusBadge, Table, Td, useMockLoad } from "@/components/ui";
import { fmt } from "@/lib/utils";

export default function Accounts() {
  const loading = useMockLoad();
  const { accounts, setAccounts, pages, setPages, nextId } = useStore();
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [errs, setErrs] = useState<{ name?: string; email?: string }>({});
  const [toDisconnect, setToDisconnect] = useState<string | null>(null);

  if (loading) return <PageSkeleton />;

  function submit() {
    const e: typeof errs = {};
    if (name.trim().length < 2) e.name = "Enter a label of at least 2 characters.";
    if (!/^\S+@\S+\.\S+$/.test(email)) e.email = "Enter a valid email address.";
    setErrs(e);
    if (Object.keys(e).length) return;
    setAccounts((a) => [...a, { id: nextId("a"), name: name.trim(), email, status: "needs_reauth", lastSync: null }]);
    toast.success("Sample account added. Real Facebook OAuth arrives in Phase 3.");
    setName(""); setEmail(""); setAddOpen(false);
  }

  return (
    <>
      <PageHeader title="Accounts" subtitle="Authorized Facebook accounts (sample data)" actions={<Button onClick={() => setAddOpen(true)}>Add account</Button>} />
      {accounts.length === 0 ? <EmptyState title="No accounts yet" hint="Add your first authorized account." action={<Button onClick={() => setAddOpen(true)}>Add account</Button>} /> : (
        <Table head={["Account", "Status", "Last sync", "Pages", "Actions"]}>
          {accounts.map((a) => (
            <tr key={a.id}>
              <Td><div className="font-medium">{a.name}</div><div className="text-xs text-slate-500">{a.email}</div></Td>
              <Td><StatusBadge status={a.status} /></Td>
              <Td>{fmt(a.lastSync)}</Td>
              <Td>{pages.filter((p) => p.accountId === a.id).length}</Td>
              <Td>
                <div className="flex gap-2">
                  {a.status !== "connected" && (
                    <Button size="sm" variant="outline" onClick={() => { setAccounts((x) => x.map((i) => i.id === a.id ? { ...i, status: "connected", lastSync: "2026-10-30T12:00:00Z" } : i)); toast.success("Marked reconnected (sample only)."); }}>Reauthorize</Button>
                  )}
                  <Button size="sm" variant="danger" onClick={() => setToDisconnect(a.id)}>Disconnect</Button>
                </div>
              </Td>
            </tr>
          ))}
        </Table>
      )}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add account">
        <div className="space-y-3">
          <p className="text-xs text-slate-500">Sample form. In Phase 3 this becomes the official Meta OAuth login — no passwords are ever entered here.</p>
          <Field label="Account label" error={errs.name}><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Contact email" error={errs.email}><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button><Button onClick={submit}>Add</Button></div>
        </div>
      </Modal>
      <ConfirmModal open={!!toDisconnect} onClose={() => setToDisconnect(null)} title="Disconnect account?" confirmLabel="Disconnect"
        message="This removes the account and its pages from the dashboard. Scheduled jobs for those pages will stop."
        onConfirm={() => { setAccounts((x) => x.filter((a) => a.id !== toDisconnect)); setPages((x) => x.filter((p) => p.accountId !== toDisconnect)); toast.success("Account disconnected."); }} />
    </>
  );
}
