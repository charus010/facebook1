"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { attempt } from "@/lib/api";
import { Button, ConfirmModal, EmptyState, Field, Input, Modal, PageHeader, PageSkeleton, StatusBadge, Table, Td, useMockLoad } from "@/components/ui";
import { fmt } from "@/lib/utils";
import { DiscoverModal } from "@/components/discover";
import { LiveDiscoverModal } from "@/components/discover-live";
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
  const [liveDiscoverFor, setLiveDiscoverFor] = useState<Account | null>(null);
  const [pendingAccount, setPendingAccount] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Facebook sends the browser back here with ?meta=...; show the result once, then clean the URL.
  useEffect(() => {
    if (!live) return;
    const q = new URLSearchParams(window.location.search);
    const result = q.get("meta");
    if (!result) return;
    window.history.replaceState(null, "", "/accounts");
    if (result === "connected") { toast.success("Facebook account connected."); setPendingAccount(q.get("account")); }
    else if (result === "denied") toast.error("Facebook login was cancelled.");
    else if (q.get("reason") === "missing_permissions") toast.error("Not all required permissions were granted. Reconnect and keep every box ticked.");
    else toast.error("Facebook login could not be completed. Try again.");
  }, [live]);
  useEffect(() => {
    if (!pendingAccount) return;
    const acc = accounts.find((a) => a.id === pendingAccount);
    if (acc) { setLiveDiscoverFor(acc); setPendingAccount(null); }
  }, [pendingAccount, accounts]);

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
      live ? "Account saved. Now connect it with Facebook." : "Sample account added. Now choose which pages to import.");
    setBusy(false);
    if (!ok) return;
    setName(""); setEmail(""); setAddOpen(false);
    if (!live && box.acc) setDiscoverFor(box.acc);
  }

  async function sync(a: Account) {
    const t = toast.loading("Syncing pages…");
    try {
      const r = await actions.syncMeta(a.id);
      toast.dismiss(t);
      toast.success(`Synced: ${r.updated} updated, ${r.lost} no longer visible, ${r.new_pages_available} new available.${r.token_expires_soon ? " Login expires soon — reconnect." : ""}`);
    } catch (e) { toast.dismiss(t); toast.error(e instanceof Error ? e.message : "Sync failed."); }
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
                  {live ? (
                    a.status === "connected" ? (
                      <>
                        <Button size="sm" variant="outline" onClick={() => setLiveDiscoverFor(a)}>Discover pages</Button>
                        <Button size="sm" variant="outline" onClick={() => void sync(a)}>Sync pages</Button>
                      </>
                    ) : <Button size="sm" onClick={() => attempt(() => actions.connectMeta(a.id))}>{a.lastSync ? "Reconnect" : "Connect with Facebook"}</Button>
                  ) : (
                    <>
                      {a.status === "connected" && <Button size="sm" variant="outline" onClick={() => setDiscoverFor(a)}>Sync pages</Button>}
                      {a.status !== "connected" && <Button size="sm" variant="outline" onClick={() => attempt(() => actions.reauthorizeAccount(a.id), "Marked reconnected (sample only).")}>Reauthorize</Button>}
                    </>
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
          <p className="text-xs text-slate-500">{live ? "This saves a label for the account. Press “Connect with Facebook” afterwards — you log in on Facebook's own page; no password is ever entered here." : "Sample form. In live mode this uses the official Meta login."}</p>
          <Field label="Account label" error={errs.name}><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Contact email" error={errs.email}><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button><Button disabled={busy} onClick={submit}>Add</Button></div>
        </div>
      </Modal>
      {discoverFor && <DiscoverModal key={discoverFor.id} account={discoverFor} onClose={() => setDiscoverFor(null)} />}
      {liveDiscoverFor && <LiveDiscoverModal key={liveDiscoverFor.id} account={liveDiscoverFor} onClose={() => setLiveDiscoverFor(null)} />}
      <ConfirmModal open={!!toDisconnect} onClose={() => setToDisconnect(null)} title="Disconnect account?" confirmLabel="Disconnect"
        message="This removes the account and its pages from the dashboard. Scheduled jobs for those pages will stop."
        onConfirm={() => { void attempt(() => actions.removeAccount(toDisconnect!), "Account disconnected."); }} />
    </>
  );
}
