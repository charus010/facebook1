"use client";
import { useState } from "react";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { attempt } from "@/lib/api";
import { Button, ConfirmModal, EmptyState, Field, Input, Modal, PageHeader, PageSkeleton, StatusBadge, Table, Td, useMockLoad } from "@/components/ui";
import { fmt } from "@/lib/utils";
import { DiscoverModal } from "@/components/discover";
import type { Account } from "@/lib/types";

export default function Accounts() {
  const loading = useMockLoad();
  const { accounts, pages, actions, live } = useStore();
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [errs, setErrs] = useState<{ name?: string; email?: string }>({});
  const [toDisconnect, setToDisconnect] = useState<string | null>(null);
  const [discoverFor, setDiscoverFor] = useState<Account | null>(null);
  const [busy, setBusy] = useState(false);

  if (loading) return <PageSkeleton />;

  async function submit() {
    const e: typeof errs = {};
    if (name.trim().length < 2) e.name = "Enter a label of at least 2 characters.";
    if (!/^\S+@\S+\.\S+$/.test(email)) e.email = "Enter a valid email address.";
    setErrs(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    const box: { acc: Account | null } = { acc: null };
    const ok = await attempt(async () => { box.acc = await actions.addAccount(name.trim(), email); },
      live ? "Account saved. It stays “needs reauth” until Meta login is connected (Phase 3)." : "Sample account added. Now choose which pages to import.");
    setBusy(false);
    if (!ok) return;
    setName(""); setEmail(""); setAddOpen(false);
    if (!live && box.acc) setDiscoverFor(box.acc);
  }

  return (
    <>
      <PageHeader title="Accounts" subtitle={live ? "Authorized Facebook accounts" : "Authorized Facebook accounts (sample data)"} actions={<Button onClick={() => setAddOpen(true)}>Add account</Button>} />
      {accounts.length === 0 ? <EmptyState title="No accounts yet" hint="Add your first authorized account." action={<Button onClick={() => setAddOpen(true)}>Add account</Button>} /> : (
        <Table head={["Account", "Status", "Last sync", "Pages", "Actions"]}>
          {accounts.map((a) => (
            <tr key={a.id}>
              <Td><div className="font-medium">{a.name}</div><div className="text-xs text-slate-500">{a.email}</div></Td>
              <Td><StatusBadge status={a.status} /></Td>
              <Td>{fmt(a.lastSync)}</Td>
              <Td>{pages.filter((p) => p.accountId === a.id).length}</Td>
              <Td>
                <div className="flex flex-wrap gap-2">
                  {!live && a.status === "connected" && <Button size="sm" variant="outline" onClick={() => setDiscoverFor(a)}>Sync pages</Button>}
                  {a.status !== "connected" && (live
                    ? <Button size="sm" variant="outline" disabled title="Meta login arrives in Phase 3">Reauthorize</Button>
                    : <Button size="sm" variant="outline" onClick={() => attempt(() => actions.reauthorizeAccount(a.id), "Marked reconnected (sample only).")}>Reauthorize</Button>)}
                  <Button size="sm" variant="danger" onClick={() => setToDisconnect(a.id)}>Disconnect</Button>
                </div>
              </Td>
            </tr>
          ))}
        </Table>
      )}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add account">
        <div className="space-y-3">
          <p className="text-xs text-slate-500">{live ? "This saves the account record. Connecting it to Facebook uses the official Meta login in Phase 3 — no passwords are ever entered here." : "Sample form. In Phase 3 this becomes the official Meta login."}</p>
          <Field label="Account label" error={errs.name}><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Contact email" error={errs.email}><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button><Button disabled={busy} onClick={submit}>Add</Button></div>
        </div>
      </Modal>
      {discoverFor && <DiscoverModal key={discoverFor.id} account={discoverFor} onClose={() => setDiscoverFor(null)} />}
      <ConfirmModal open={!!toDisconnect} onClose={() => setToDisconnect(null)} title="Disconnect account?" confirmLabel="Disconnect"
        message="This removes the account and its pages from the dashboard. Scheduled jobs for those pages will stop."
        onConfirm={() => { void attempt(() => actions.removeAccount(toDisconnect!), "Account disconnected."); }} />
    </>
  );
}
