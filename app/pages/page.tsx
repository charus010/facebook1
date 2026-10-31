"use client";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { attempt } from "@/lib/api";
import type { FbPage, MediaMode } from "@/lib/types";
import { Badge, Button, EmptyState, Field, Input, Modal, Select, PageHeader, PageSkeleton, StatusBadge, Table, Td, useMockLoad } from "@/components/ui";
import { fmt } from "@/lib/utils";

const contentLabel = (p: FbPage) => (p.mediaMode === "both" ? `videos + images (${p.imagePercent}% images)` : `${p.mediaMode}s only`);

export default function PagesView() {
  const loading = useMockLoad();
  const { pages, accounts, actions, live } = useStore();
  const [detail, setDetail] = useState<FbPage | null>(null);
  const [edit, setEdit] = useState<FbPage | null>(null);
  const [limit, setLimit] = useState("");
  const [err, setErr] = useState("");
  const [mode, setMode] = useState<MediaMode>("video");
  const [pct, setPct] = useState("30");

  if (loading) return <PageSkeleton />;

  async function save() {
    const n = Number(limit);
    if (!Number.isInteger(n) || n < 1 || n > 50) { setErr("Enter a whole number from 1 to 50."); return; }
    const pc = Number(pct);
    if (mode === "both" && (!Number.isInteger(pc) || pc < 0 || pc > 100)) { setErr("Image share must be a whole number from 0 to 100."); return; }
    const ok = await attempt(async () => {
      await actions.updatePageLimit(edit!.id, n);
      await actions.updatePageMedia(edit!.id, mode, mode === "both" ? pc : edit!.imagePercent);
    }, "Settings saved.");
    if (ok) { setEdit(null); setErr(""); }
  }

  return (
    <>
      <PageHeader title="Facebook Pages" subtitle={live ? "Pages under authorized accounts. New pages start paused." : "Pages under authorized accounts (sample data)"} />
      {pages.length === 0 ? <EmptyState title="No pages" hint="Connect an account to discover pages." /> : (
        <Table head={["Page", "Account", "Status", "Automation", "Today / Limit", "Content", "Last success", "Last error", "Actions"]}>
          {pages.map((p) => (
            <tr key={p.id}>
              <Td><div className="font-medium">{p.name}</div><div className="text-xs text-slate-500">ID {p.fbId}</div></Td>
              <Td>{accounts.find((a) => a.id === p.accountId)?.name}</Td>
              <Td><StatusBadge status={p.status} /></Td>
              <Td><Badge tone={p.enabled ? "green" : "slate"}>{p.enabled ? "enabled" : "paused"}</Badge></Td>
              <Td>{p.publishedToday} / {p.dailyLimit}</Td>
              <Td className="text-xs">{contentLabel(p)}</Td>
              <Td>{fmt(p.lastSuccess)}</Td>
              <Td className="max-w-[200px] text-xs text-red-600">{p.lastError ?? "—"}</Td>
              <Td>
                <div className="flex flex-wrap gap-1">
                  <Button size="sm" variant="outline" onClick={() => setDetail(p)}>Details</Button>
                  <Button size="sm" variant="outline" onClick={() => { setEdit(p); setLimit(String(p.dailyLimit)); setMode(p.mediaMode); setPct(String(p.imagePercent)); setErr(""); }}>Edit</Button>
                  <Button size="sm" variant="outline" disabled={p.status !== "connected" && !p.enabled}
                    onClick={() => attempt(() => actions.togglePage(p.id), p.enabled ? "Page paused." : "Page resumed.")}>{p.enabled ? "Pause" : "Resume"}</Button>
                  {p.status !== "connected" && (live
                    ? <Button size="sm" disabled title="Meta login arrives in Phase 3">Reconnect</Button>
                    : <Button size="sm" onClick={() => attempt(() => actions.reconnectPage(p.id), "Marked reconnected (sample only).")}>Reconnect</Button>)}
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
            <dt className="text-slate-500">Content</dt><dd>{contentLabel(detail)}</dd>
            <dt className="text-slate-500">Published today</dt><dd>{detail.publishedToday}</dd>
            <dt className="text-slate-500">Last success</dt><dd>{fmt(detail.lastSuccess)}</dd>
            <dt className="text-slate-500">Last error</dt><dd>{detail.lastError ?? "—"}</dd>
          </dl>
        )}
      </Modal>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={`Edit ${edit?.name ?? ""}`}>
        <div className="space-y-3">
          <Field label="Daily posting limit (1–50)"><Input type="number" value={limit} onChange={(e) => setLimit(e.target.value)} /></Field>
          <Field label="Content this page posts">
            <Select value={mode} onChange={(e) => setMode(e.target.value as MediaMode)}>
              <option value="video">Videos only</option><option value="image">Images only</option><option value="both">Videos and images</option>
            </Select>
          </Field>
          {mode === "both" && <Field label="Share of images (%)" error={err}><Input type="number" min={0} max={100} value={pct} onChange={(e) => setPct(e.target.value)} /></Field>}
          {err && mode !== "both" && <p role="alert" className="text-xs text-red-600">{err}</p>}
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button><Button onClick={save}>Save</Button></div>
        </div>
      </Modal>
    </>
  );
}
