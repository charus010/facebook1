"use client";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { attempt } from "@/lib/api";
import type { FbPage } from "@/lib/types";
import { Badge, Button, EmptyState, Field, Input, Modal, PageHeader, PageSkeleton, StatusBadge, Table, Td, useMockLoad } from "@/components/ui";
import { fmt } from "@/lib/utils";

const planLabel = (p: FbPage) => `${p.dailyVideoLimit} videos + ${p.dailyImageLimit} images`;

export default function PagesView() {
  const loading = useMockLoad();
  const { pages, accounts, actions, live } = useStore();
  const [detail, setDetail] = useState<FbPage | null>(null);
  const [edit, setEdit] = useState<FbPage | null>(null);
  const [vids, setVids] = useState("0");
  const [imgs, setImgs] = useState("0");
  const [err, setErr] = useState("");

  if (loading) return <PageSkeleton />;
  const total = (Number(vids) || 0) + (Number(imgs) || 0);

  async function save() {
    const v = Number(vids), i = Number(imgs);
    if (![v, i].every((n) => Number.isInteger(n) && n >= 0 && n <= 50)) { setErr("Each value must be a whole number from 0 to 50."); return; }
    if (v + i < 1 || v + i > 50) { setErr("Videos + images per day must total 1 to 50."); return; }
    if (await attempt(() => actions.updatePageLimits(edit!.id, v, i), "Daily plan saved.")) { setEdit(null); setErr(""); }
  }

  return (
    <>
      <PageHeader title="Facebook Pages" subtitle={live ? "Pages under authorized accounts. New pages start paused." : "Pages under authorized accounts (sample data)"} />
      {pages.length === 0 ? <EmptyState title="No pages" hint="Connect an account to discover pages." /> : (
        <Table head={["Page", "Account", "Status", "Automation", "Today / Limit", "Daily plan", "Last success", "Last error", "Actions"]}>
          {pages.map((p) => (
            <tr key={p.id}>
              <Td><div className="font-medium">{p.name}</div><div className="text-xs text-slate-500">ID {p.fbId}</div></Td>
              <Td>{accounts.find((a) => a.id === p.accountId)?.name}</Td>
              <Td><StatusBadge status={p.status} /></Td>
              <Td><Badge tone={p.enabled ? "green" : "slate"}>{p.enabled ? "enabled" : "paused"}</Badge></Td>
              <Td>{p.publishedToday} / {p.dailyLimit}</Td>
              <Td className="whitespace-nowrap text-xs">{planLabel(p)}</Td>
              <Td>{fmt(p.lastSuccess)}</Td>
              <Td className="max-w-[200px] text-xs text-red-600">{p.lastError ?? "—"}</Td>
              <Td>
                <div className="flex flex-wrap gap-1">
                  <Button size="sm" variant="outline" onClick={() => setDetail(p)}>Details</Button>
                  <Button size="sm" variant="outline" onClick={() => { setEdit(p); setVids(String(p.dailyVideoLimit)); setImgs(String(p.dailyImageLimit)); setErr(""); }}>Edit</Button>
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
            <dt className="text-slate-500">Daily plan</dt><dd>{planLabel(detail)} ({detail.dailyLimit} total)</dd>
            <dt className="text-slate-500">Published today</dt><dd>{detail.publishedToday}</dd>
            <dt className="text-slate-500">Last success</dt><dd>{fmt(detail.lastSuccess)}</dd>
            <dt className="text-slate-500">Last error</dt><dd>{detail.lastError ?? "—"}</dd>
          </dl>
        )}
      </Modal>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={`Daily plan — ${edit?.name ?? ""}`}>
        <div className="space-y-3">
          <p className="text-xs text-slate-500">How many items this page may post on each day (counted in the page&apos;s own timezone: {edit?.timezone}). This repeats every day.</p>
          <Field label="Videos per day (0–50)"><Input type="number" min={0} max={50} value={vids} onChange={(e) => setVids(e.target.value)} /></Field>
          <Field label="Images per day (0–50)"><Input type="number" min={0} max={50} value={imgs} onChange={(e) => setImgs(e.target.value)} /></Field>
          <p className="text-sm font-medium">Total per day: {total}</p>
          {err && <p role="alert" className="text-xs text-red-600">{err}</p>}
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button><Button onClick={save}>Save</Button></div>
        </div>
      </Modal>
    </>
  );
}
