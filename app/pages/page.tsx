"use client";
import { useState } from "react";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import type { FbPage } from "@/lib/types";
import { Badge, Button, EmptyState, Field, Input, Modal, PageHeader, PageSkeleton, StatusBadge, Table, Td, useMockLoad } from "@/components/ui";
import { fmt } from "@/lib/utils";

export default function PagesView() {
  const loading = useMockLoad();
  const { pages, setPages, accounts } = useStore();
  const [detail, setDetail] = useState<FbPage | null>(null);
  const [edit, setEdit] = useState<FbPage | null>(null);
  const [limit, setLimit] = useState("");
  const [err, setErr] = useState("");

  if (loading) return <PageSkeleton />;
  const patch = (id: string, p: Partial<FbPage>) => setPages((x) => x.map((i) => (i.id === id ? { ...i, ...p } : i)));

  function save() {
    const n = Number(limit);
    if (!Number.isInteger(n) || n < 1 || n > 50) { setErr("Enter a whole number from 1 to 50."); return; }
    patch(edit!.id, { dailyLimit: n });
    toast.success("Settings saved (sample).");
    setEdit(null); setErr("");
  }

  return (
    <>
      <PageHeader title="Facebook Pages" subtitle="Pages under authorized accounts (sample data)" />
      {pages.length === 0 ? <EmptyState title="No pages" hint="Connect an account to discover pages." /> : (
        <Table head={["Page", "Account", "Status", "Automation", "Today / Limit", "Last success", "Last error", "Actions"]}>
          {pages.map((p) => (
            <tr key={p.id}>
              <Td><div className="font-medium">{p.name}</div><div className="text-xs text-slate-500">ID {p.fbId}</div></Td>
              <Td>{accounts.find((a) => a.id === p.accountId)?.name}</Td>
              <Td><StatusBadge status={p.status} /></Td>
              <Td><Badge tone={p.enabled ? "green" : "slate"}>{p.enabled ? "enabled" : "paused"}</Badge></Td>
              <Td>{p.publishedToday} / {p.dailyLimit}</Td>
              <Td>{fmt(p.lastSuccess)}</Td>
              <Td className="max-w-[200px] text-xs text-red-600">{p.lastError ?? "—"}</Td>
              <Td>
                <div className="flex flex-wrap gap-1">
                  <Button size="sm" variant="outline" onClick={() => setDetail(p)}>Details</Button>
                  <Button size="sm" variant="outline" onClick={() => { setEdit(p); setLimit(String(p.dailyLimit)); setErr(""); }}>Edit</Button>
                  <Button size="sm" variant="outline" disabled={p.status !== "connected"} onClick={() => { patch(p.id, { enabled: !p.enabled }); toast.success(p.enabled ? "Page paused." : "Page resumed."); }}>{p.enabled ? "Pause" : "Resume"}</Button>
                  {p.status !== "connected" && <Button size="sm" onClick={() => { patch(p.id, { status: "connected", lastError: null }); toast.success("Marked reconnected (sample only)."); }}>Reconnect</Button>}
                </div>
              </Td>
            </tr>
          ))}
        </Table>
      )}
      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.name ?? ""}>
        {detail && (
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-slate-500">Page ID</dt><dd>{detail.fbId}</dd>
            <dt className="text-slate-500">Timezone</dt><dd>{detail.timezone}</dd>
            <dt className="text-slate-500">Daily limit</dt><dd>{detail.dailyLimit}</dd>
            <dt className="text-slate-500">Published today</dt><dd>{detail.publishedToday}</dd>
            <dt className="text-slate-500">Last success</dt><dd>{fmt(detail.lastSuccess)}</dd>
            <dt className="text-slate-500">Last error</dt><dd>{detail.lastError ?? "—"}</dd>
          </dl>
        )}
      </Modal>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={`Edit ${edit?.name ?? ""}`}>
        <div className="space-y-3">
          <Field label="Daily posting limit (1–50)" error={err}><Input type="number" value={limit} onChange={(e) => setLimit(e.target.value)} /></Field>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button><Button onClick={save}>Save</Button></div>
        </div>
      </Modal>
    </>
  );
}
