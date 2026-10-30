"use client";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import type { Caption } from "@/lib/types";
import { Button, ConfirmModal, EmptyState, Field, Input, Modal, PageHeader, PageSkeleton, Select, Table, Td, Textarea, useMockLoad } from "@/components/ui";

const CATS = ["Travel", "Food", "Fitness", "Tech", "General"];
interface Parsed { rows: Omit<Caption, "id">[]; invalid: string[]; duplicates: number }

function parseCsv(text: string, existing: Caption[]): Parsed {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const seen = new Set(existing.map((c) => c.title.trim().toLowerCase()));
  const out: Parsed = { rows: [], invalid: [], duplicates: 0 };
  lines.forEach((line, i) => {
    if (i === 0 && /^title\s*,/i.test(line)) return;
    const [title, description, category] = line.split(",").map((s) => s?.trim().replace(/^"|"$/g, ""));
    if (!title || !description) { out.invalid.push(`Line ${i + 1}: title and description are required.`); return; }
    if (seen.has(title.toLowerCase())) { out.duplicates++; return; }
    seen.add(title.toLowerCase());
    out.rows.push({ title, description, category: CATS.includes(category) ? category : "General" });
  });
  return out;
}

export default function Captions() {
  const loading = useMockLoad();
  const { captions, setCaptions, nextId, settings } = useStore();
  const [filter, setFilter] = useState("all");
  const [edit, setEdit] = useState<Caption | "new" | null>(null);
  const [form, setForm] = useState({ title: "", description: "", category: "General" });
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
  function save() {
    const e: typeof errs = {};
    if (!form.title.trim()) e.title = "Title is required.";
    if (form.title.length > 100) e.title = "Max 100 characters.";
    if (!form.description.trim()) e.description = "Description is required.";
    setErrs(e);
    if (Object.keys(e).length) return;
    if (edit === "new") setCaptions((x) => [...x, { id: nextId("c"), ...form }]);
    else setCaptions((x) => x.map((i) => (i.id === (edit as Caption).id ? { ...i, ...form } : i)));
    toast.success("Saved."); setEdit(null);
  }
  async function onFile(f: File | undefined) {
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".csv")) { toast.error("Phase 1 supports .csv only. Excel import comes with the backend."); return; }
    setImp(parseCsv(await f.text(), captions));
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <>
      <PageHeader title="Titles & Descriptions" subtitle={`Selection mode: ${settings.randomMode} · no repeat for ${settings.noRepeatDays} days (change in Settings)`}
        actions={<><input ref={fileRef} type="file" accept=".csv" hidden onChange={(e) => onFile(e.target.files?.[0])} />
          <Button variant="outline" onClick={() => fileRef.current?.click()}>Import CSV</Button><Button onClick={() => open("new")}>Add caption</Button></>} />
      <p className="mb-3 text-xs text-slate-500">CSV columns: title, description, category (optional). Header row optional.</p>
      <Select aria-label="Filter by category" value={filter} onChange={(e) => setFilter(e.target.value)} className="mb-4 max-w-[200px]">
        <option value="all">all categories</option>{CATS.map((c) => <option key={c}>{c}</option>)}
      </Select>
      {list.length === 0 ? <EmptyState title="No captions" hint="Add one or import a CSV." /> : (
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
            <p className="text-green-700 dark:text-green-400">{imp.rows.length} valid row(s) ready to import.</p>
            <p className="text-amber-700 dark:text-amber-400">{imp.duplicates} duplicate title(s) skipped.</p>
            <p className="text-red-600">{imp.invalid.length} invalid row(s).</p>
            {imp.invalid.length > 0 && <ul className="list-disc pl-5 text-xs text-red-600">{imp.invalid.slice(0, 10).map((m) => <li key={m}>{m}</li>)}</ul>}
            <div className="flex justify-end gap-2 pt-2"><Button variant="outline" onClick={() => setImp(null)}>Cancel</Button>
              <Button disabled={imp.rows.length === 0} onClick={() => { setCaptions((x) => [...x, ...imp.rows.map((r) => ({ id: nextId("c"), ...r }))]); toast.success(`${imp.rows.length} imported.`); setImp(null); }}>Import valid rows</Button></div>
          </div>
        )}
      </Modal>
      <ConfirmModal open={!!del} onClose={() => setDel(null)} title="Delete caption?" confirmLabel="Delete" message={`Delete "${del?.title}"?`}
        onConfirm={() => { setCaptions((x) => x.filter((i) => i.id !== del!.id)); toast.success("Deleted."); }} />
    </>
  );
}
