"use client";
import { useState } from "react";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { discoverPages } from "@/lib/discover";
import type { Account, FbPage } from "@/lib/types";
import { Badge, Button, Modal } from "@/components/ui";

export function DiscoverModal({ account, onClose }: { account: Account; onClose: () => void }) {
  const { pages, setPages, nextId } = useStore();
  const found = discoverPages(account.id, account.name);
  const imported = new Set(pages.map((p) => p.fbId));
  const [sel, setSel] = useState<Set<string>>(new Set(found.filter((d) => d.canPublish && !imported.has(d.fbId)).map((d) => d.fbId)));

  const toggle = (id: string) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  function doImport() {
    const added: FbPage[] = found.filter((d) => sel.has(d.fbId) && !imported.has(d.fbId)).map((d) => ({
      id: nextId("p"), fbId: d.fbId, name: d.name, accountId: account.id,
      status: d.canPublish ? "connected" : "needs_attention",
      enabled: false, dailyLimit: 3, publishedToday: 0, mediaMode: "video", imagePercent: 30, lastSuccess: null,
      lastError: d.canPublish ? null : "Publish permission not verified (sample)", timezone: "UTC",
    }));
    setPages((x) => [...x, ...added]);
    toast.success(`${added.length} page(s) imported as PAUSED. Set limits, then resume them.`);
    onClose();
  }

  return (
    <Modal open onClose={onClose} title={`Discovered pages — ${account.name}`}>
      <p className="mb-3 text-xs text-slate-500">Sample list. In Phase 3 this comes from Meta. Only pages you tick are imported, and they start paused.</p>
      <ul className="space-y-2">
        {found.map((d) => {
          const already = imported.has(d.fbId);
          return (
            <li key={d.fbId} className="flex items-center justify-between gap-2 rounded-md border border-slate-200 p-2 text-sm dark:border-slate-700">
              <label className="flex items-center gap-2">
                <input type="checkbox" disabled={already} checked={sel.has(d.fbId)} onChange={() => toggle(d.fbId)} />
                <span>{d.name}</span>
              </label>
              {already ? <Badge>already imported</Badge> : d.canPublish ? <Badge tone="green">can publish</Badge> : <Badge tone="amber">no publish permission</Badge>}
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs text-slate-500">Pages without publish permission can be imported but will be flagged “needs attention”.</p>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>Skip for now</Button>
        <Button disabled={sel.size === 0} onClick={doImport}>Import {sel.size} page(s)</Button>
      </div>
    </Modal>
  );
}
