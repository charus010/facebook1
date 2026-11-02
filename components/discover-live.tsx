"use client";
/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useStore, type Discovered } from "@/lib/store";
import { errMsg } from "@/lib/api";
import type { Account } from "@/lib/types";
import { Badge, Button, Modal } from "@/components/ui";

/** Lists the Pages Facebook says this account can manage. Imported Pages always start paused. */
export function LiveDiscoverModal({ account, onClose }: { account: Account; onClose: () => void }) {
  const { actions } = useStore();
  const [pages, setPages] = useState<Discovered[] | null>(null);
  const [error, setError] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    actions.discoverMeta(account.id)
      .then((p) => {
        if (!alive) return;
        setPages(p);
        setSel(new Set(p.filter((x) => x.can_publish && !x.already_imported && !x.imported_by_other_account).map((x) => x.fb_page_id)));
      })
      .catch((e) => alive && setError(errMsg(e)));
    return () => { alive = false; };
  }, [account.id]);

  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  async function doImport() {
    setBusy(true);
    try {
      const r = await actions.importMeta(account.id, Array.from(sel));
      toast.success(`${r.imported} page(s) imported as PAUSED.${r.skipped ? ` ${r.skipped} skipped (managed by another account).` : ""}`);
      onClose();
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  }

  return (
    <Modal open onClose={onClose} title={`Pages — ${account.name}`}>
      {error ? <p role="alert" className="text-sm text-red-600">{error}</p>
        : pages === null ? <p className="text-sm text-slate-500">Asking Facebook for your Pages…</p>
        : pages.length === 0 ? <p className="text-sm text-slate-500">Facebook returned no Pages for this account. Check that you have a role on a Page and granted the permissions.</p> : (
          <>
            <p className="mb-3 text-xs text-slate-500">Only ticked Pages are imported, and they start paused. A Page without publish rights is imported as “needs attention”.</p>
            <ul className="space-y-2">
              {pages.map((d) => {
                const locked = d.already_imported || d.imported_by_other_account;
                return (
                  <li key={d.fb_page_id} className="flex items-center justify-between gap-2 rounded-md border border-slate-200 p-2 text-sm dark:border-slate-700">
                    <label className="flex items-center gap-2"><input type="checkbox" disabled={locked} checked={sel.has(d.fb_page_id)} onChange={() => toggle(d.fb_page_id)} /><span>{d.name}</span></label>
                    {d.already_imported ? <Badge>already imported</Badge> : d.imported_by_other_account ? <Badge tone="amber">managed by another account</Badge>
                      : d.can_publish ? <Badge tone="green">can publish</Badge> : <Badge tone="amber">no publish permission</Badge>}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>Close</Button>
        {pages && pages.length > 0 && <Button disabled={busy || sel.size === 0} onClick={doImport}>Import {sel.size} page(s)</Button>}
      </div>
    </Modal>
  );
}
