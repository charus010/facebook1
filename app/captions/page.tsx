"use client";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { useStore, type CaptionInput } from "@/lib/store";
import { attempt, errMsg } from "@/lib/api";
import type { Caption } from "@/lib/types";
import { Button, ConfirmModal, EmptyState, Field, Input, Modal, PageHeader, PageSkeleton, Select, Table, Td, Textarea, useMockLoad } from "@/components/ui";

const CATS = ["Travel", "Food", "Fitness", "Tech", "General"];
interface Parsed { rows: CaptionInput[]; valid: number; invalid: string[]; duplicates: number; file?: File }

function parseCsv(text: string, existing: Caption[]): Parsed {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const seen = new Set(existing.map((c) => c.title.trim().toLowerCase()));
  const out: Parsed = { rows: [], valid: 0, invalid: [], duplicates: 0 };
  lines.forEach((line, i) => {
    if (i === 0 && /^title\s*,/i.test(line)) return;
    const [title, description, category] = line.split(",").map((s) => s?.trim().replace(/^"|"$/g, ""));
    if (!title || !description) { out.invalid.push(`Line ${i + 1}: title and description are required.`); return; }
    if (seen.has(title.toLowerCase())) { out.duplicates++; return; }
    seen.add(title.toLowerCase());
    out.rows.push({ title, description, category: CATS.includes(category) ? category : "General" });
  });
  out.valid = out.rows.length;
  return out;
}

export default function Captions() {
  const loading = useMockLoad();
  const { captions, actions, settings, live } = useStore();
  const [filter, setFilter] = useState("all");
  const [edit, setEdit] = useState<Caption | "new" | null>(null);
  const [form, setForm] = useState<CaptionInput>({ title: "", description: "", category: "General" });
  const [errs, setErrs] = useState<{ title?: string; description?: string }>({});
  const [del, setDel] = useState<Caption | null>(null);
  const [imp, setImp] = useState<Parsed | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  if (loading) return <PageSkeleton />;
  const list = captions.filter((c) => filter === "all" || c.category === filter);

  function open(c: Caption | "new") {
    setEdit(c); setErrs({});
    setForm(c === "new" ? { title: "", description: "", category: "General" } : { title: c.title, description: c.description, category: c.category });
  }
  async function save() {
    const e: typeof errs = {};
    if (!form.title.trim()) e.title = "Title is required.";
    if (form.title.length > 100) e.title = "Max 100 characters.";
    if (!form.description.trim()) e.description = "Description is required.";
    setErrs(e);
    if (Object.keys(e).length) return;
    if (await attempt(() => actions.saveCaption(edit === "new" ? null : (edit as Caption).id, form), "Saved.")) setEdit(null);
  }
  async function onFile(f: File | undefined) {
    if (!f) return;
    const name = f.name.toLowerCase();
    try {
      if (live) {
        if (!name.endsWith(".csv") && !name.endsWith(".xlsx")) { toast.error("Upload a .csv or .xlsx file."); return; }
        const r = await actions.importCaptionFile(f, true);
        setImp({ rows: [], valid: r.valid, invalid: r.invalid, duplicates: r.duplicates, file: f });
      } else {
        if (!name.endsWith(".csv")) { toast.error("Sample mode supports .csv only (Excel works with the live backend)."); return; }
        setImp(parseCsv(await f.text(), captions));
      }
    } catch (e) { toast.error(errMsg(e)); }
    if (fileRef.current) fileRef.current.value = "";
  }
  async function confirmImport() {
    if (!imp) return;
    const ok = await attempt(async () => {
      if (live && imp.file) await actions.importCaptionFile(imp.file, false);
      else await actions.importCaptionRows(imp.rows);
    }, `${imp.valid} imported.`);
    if (ok) setImp(null);
  }

  return (
    <>
      <PageHeader title="Titles & Descriptions" subtitle={`Selection mode: ${settings.randomMode} · no repeat for ${settings.noRepeatDays} days (change in Settings)`}
        actions={<><input ref={fileRef} type="file" accept={live ? ".csv,.xlsx" : ".csv"} hidden onChange={(e) => void onFile(e.target.files?.[0])} />
          <Button variant="outline" onClick={() => fileRef.current?.click()}>{live ? "Import CSV / Excel" : "Import CSV"}</Button><Button onClick={() => open("new")}>Add caption</Button></>} />
      <p className="mb-3 text-xs text-slate-500">Columns: title, description, category (optional). Header row optional. Duplicate titles are skipped.</p>
      <Select aria-label="Filter by category" value={filter} onChange={(e) => setFilter(e.target.value)} className="mb-4 max-w-[200px]">
        <option value="all">all categories</option>{CATS.map((c) => <option key={c}>{c}</option>)}
      </Select>
      {list.length === 0 ? <EmptyState title="No captions" hint="Add one or import a file." /> : (
        <Table head={["Title", "Description", "Category", "Actions"]}>
          {list.map((c) => (
            <tr key={c.id}><Td className="font-medium">{c.title}</Td><Td className="max-w-md text-slate-600 dark:text-slate-300">{c.description}</Td><Td>{c.category}</Td>
              <Td><div className="flex gap-1"><Button size="sm" variant="outline" onClick={() => open(c)}>Edit</Button><Button size="sm" variant="danger" onClick={() => setDel(c)}>Delete</Button></div></Td></tr>
          ))}
        </Table>
      )}
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit === "new" ? "Add caption" : "Edit caption"}>
        <div className="space-y-3">
          <Field label="Title" error={errs.title}><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
          <Field label="Description" error={errs.description}><Textarea rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <Field label="Category"><Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{CATS.map((c) => <option key={c}>{c}</option>)}</Select></Field>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button><Button onClick={save}>Save</Button></div>
        </div>
      </Modal>
      <Modal open={!!imp} onClose={() => setImp(null)} title="Import validation results">
        {imp && (
          <div className="space-y-2 text-sm">
            <p className="text-green-700 dark:text-green-400">{imp.valid} valid row(s) ready to import.</p>
            <p className="text-amber-700 dark:text-amber-400">{imp.duplicates} duplicate title(s) skipped.</p>
            <p className="text-red-600">{imp.invalid.length} invalid row(s).</p>
            {imp.invalid.length > 0 && <ul className="list-disc pl-5 text-xs text-red-600">{imp.invalid.slice(0, 10).map((m) => <li key={m}>{m}</li>)}</ul>}
            <div className="flex justify-end gap-2 pt-2"><Button variant="outline" onClick={() => setImp(null)}>Cancel</Button>
              <Button disabled={imp.valid === 0} onClick={confirmImport}>Import valid rows</Button></div>
          </div>
        )}
      </Modal>
      <ConfirmModal open={!!del} onClose={() => setDel(null)} title="Delete caption?" confirmLabel="Delete" message={`Delete "${del?.title}"?`}
        onConfirm={() => { void attempt(() => actions.removeCaption(del!.id), "Deleted."); }} />
    </>
  );
}
