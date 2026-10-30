"use client";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import type { Video } from "@/lib/types";
import { Button, ConfirmModal, EmptyState, Field, Input, Modal, PageHeader, PageSkeleton, Select, StatusBadge, useMockLoad, Card } from "@/components/ui";
import { Film } from "lucide-react";

const CATS = ["Travel", "Food", "Fitness", "Tech", "General"];

export default function Videos() {
  const loading = useMockLoad();
  const { videos, setVideos, history, pages, nextId } = useStore();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [edit, setEdit] = useState<Video | null>(null);
  const [cat, setCat] = useState("General");
  const [del, setDel] = useState<Video | null>(null);
  const [hist, setHist] = useState<Video | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  if (loading) return <PageSkeleton />;
  const list = videos.filter((v) => v.filename.toLowerCase().includes(q.toLowerCase()) && (status === "all" || v.status === status));

  function onFiles(files: FileList | null) {
    if (!files) return;
    const added: Video[] = [];
    for (const f of Array.from(files)) {
      if (!f.type.startsWith("video/")) { toast.error(`${f.name}: not a video file.`); continue; }
      if (f.size > 2 * 1024 ** 3) { toast.error(`${f.name}: larger than 2 GB.`); continue; }
      added.push({ id: nextId("v"), filename: f.name, sizeMb: Math.max(1, Math.round(f.size / 1024 / 1024)), status: "ready", category: "General", uploadedAt: "2026-10-30T12:00:00Z", posts: 0, views: null });
    }
    if (added.length) { setVideos((v) => [...added, ...v]); toast.success(`${added.length} video(s) listed. Files are NOT uploaded anywhere in Phase 1.`); }
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <>
      <PageHeader title="Video Library" subtitle="Sample entries; real storage arrives in Phase 2/4"
        actions={<><input ref={fileRef} type="file" accept="video/*" multiple hidden onChange={(e) => onFiles(e.target.files)} /><Button onClick={() => fileRef.current?.click()}>Select videos</Button></>} />
      <div className="mb-4 flex flex-wrap gap-2">
        <Input aria-label="Search videos" placeholder="Search filename…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
        <Select aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)} className="max-w-[180px]">
          {["all", "ready", "uploading", "processing", "failed"].map((s) => <option key={s}>{s}</option>)}
        </Select>
      </div>
      {list.length === 0 ? <EmptyState title="No videos found" hint="Adjust filters or select videos to add." /> : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((v) => (
            <Card key={v.id}>
              <div className="mb-3 flex h-28 items-center justify-center rounded-md bg-slate-100 dark:bg-slate-800" aria-label="Thumbnail placeholder"><Film className="text-slate-400" /></div>
              <div className="flex items-start justify-between gap-2"><p className="break-all text-sm font-medium">{v.filename}</p><StatusBadge status={v.status} /></div>
              <p className="mt-1 text-xs text-slate-500">{v.sizeMb} MB · {v.category} · {v.posts} post(s)</p>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setHist(v)}>History</Button>
                <Button size="sm" variant="outline" onClick={() => { setEdit(v); setCat(v.category); }}>Edit</Button>
                <Button size="sm" variant="danger" onClick={() => setDel(v)}>Delete</Button>
              </div>
            </Card>
          ))}
        </div>
      )}
      <Modal open={!!edit} onClose={() => setEdit(null)} title="Edit video">
        <div className="space-y-3">
          <Field label="Category"><Select value={cat} onChange={(e) => setCat(e.target.value)}>{CATS.map((c) => <option key={c}>{c}</option>)}</Select></Field>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button>
            <Button onClick={() => { setVideos((x) => x.map((i) => i.id === edit!.id ? { ...i, category: cat } : i)); toast.success("Video updated."); setEdit(null); }}>Save</Button></div>
        </div>
      </Modal>
      <Modal open={!!hist} onClose={() => setHist(null)} title={`Posting history — ${hist?.filename ?? ""}`}>
        {hist && (history.filter((h) => h.videoId === hist.id).length === 0 ? <p className="text-sm text-slate-500">Never posted.</p> : (
          <ul className="space-y-1 text-sm">{history.filter((h) => h.videoId === hist.id).map((h) => <li key={h.id}>{pages.find((p) => p.id === h.pageId)?.name} — <StatusBadge status={h.status} /></li>)}</ul>
        ))}
      </Modal>
      <ConfirmModal open={!!del} onClose={() => setDel(null)} title="Delete video?" confirmLabel="Delete" message={`Remove ${del?.filename} from the library?`}
        onConfirm={() => { setVideos((x) => x.filter((i) => i.id !== del!.id)); toast.success("Video removed."); }} />
    </>
  );
}
