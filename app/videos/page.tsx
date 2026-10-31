"use client";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { attempt } from "@/lib/api";
import type { Video } from "@/lib/types";
import { Badge, Button, Card, ConfirmModal, EmptyState, Field, Input, Modal, PageHeader, PageSkeleton, Select, StatusBadge, useMockLoad } from "@/components/ui";
import { Film, Image as ImageIcon } from "lucide-react";

const CATS = ["Travel", "Food", "Fitness", "Tech", "General"];

export default function MediaLibrary() {
  const loading = useMockLoad();
  const { videos, history, pages, actions, live } = useStore();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");
  const [edit, setEdit] = useState<Video | null>(null);
  const [cat, setCat] = useState("General");
  const [del, setDel] = useState<Video | null>(null);
  const [hist, setHist] = useState<Video | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (loading) return <PageSkeleton />;
  const list = videos.filter((v) => v.filename.toLowerCase().includes(q.toLowerCase()) && (status === "all" || v.status === status) && (type === "all" || v.mediaType === type));
  const nVideos = videos.filter((v) => v.mediaType === "video").length;

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    const toastId = live ? toast.loading(`Uploading ${files.length} file(s)…`) : undefined;
    const r = await actions.uploadMedia(Array.from(files));
    if (toastId !== undefined) toast.dismiss(toastId);
    setUploading(false);
    r.errors.forEach((m) => toast.error(m));
    if (r.added) toast.success(live ? `${r.added} file(s) uploaded.` : `${r.added} file(s) listed. Nothing is uploaded anywhere in sample mode.`);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <>
      <PageHeader title="Media Library" subtitle={`${nVideos} videos · ${videos.length - nVideos} images. ${live ? "Videos: MP4/MOV/M4V. Images: JPG/PNG (max 10 MB)." : "Sample entries — nothing is uploaded."}`}
        actions={<><input ref={fileRef} type="file" accept="video/mp4,video/quicktime,video/x-m4v,image/jpeg,image/png" multiple hidden onChange={(e) => void onFiles(e.target.files)} />
          <Button disabled={uploading} onClick={() => fileRef.current?.click()}>{uploading ? "Uploading…" : live ? "Upload media" : "Select media"}</Button></>} />
      <div className="mb-4 flex flex-wrap gap-2">
        <Input aria-label="Search media" placeholder="Search filename…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
        <Select aria-label="Filter by type" value={type} onChange={(e) => setType(e.target.value)} className="max-w-[160px]">
          <option value="all">all types</option><option value="video">videos</option><option value="image">images</option>
        </Select>
        <Select aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)} className="max-w-[180px]">
          {["all", "ready", "uploading", "processing", "failed"].map((s) => <option key={s}>{s}</option>)}
        </Select>
      </div>
      {list.length === 0 ? <EmptyState title="No media found" hint="Adjust filters or upload videos and images." /> : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((v) => (
            <Card key={v.id}>
              <div className="mb-3 flex h-28 items-center justify-center rounded-md bg-slate-100 dark:bg-slate-800" aria-label="Thumbnail placeholder">
                {v.mediaType === "image" ? <ImageIcon className="text-slate-400" /> : <Film className="text-slate-400" />}
              </div>
              <div className="flex items-start justify-between gap-2"><p className="break-all text-sm font-medium">{v.filename}</p><StatusBadge status={v.status} /></div>
              <p className="mt-1 flex flex-wrap items-center gap-1 text-xs text-slate-500"><Badge tone={v.mediaType === "image" ? "blue" : "slate"}>{v.mediaType}</Badge>{v.sizeMb} MB · {v.category} · {v.posts} post(s)</p>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setHist(v)}>History</Button>
                <Button size="sm" variant="outline" onClick={() => { setEdit(v); setCat(v.category); }}>Edit</Button>
                <Button size="sm" variant="danger" onClick={() => setDel(v)}>Delete</Button>
              </div>
            </Card>
          ))}
        </div>
      )}
      <Modal open={!!edit} onClose={() => setEdit(null)} title="Edit media">
        <div className="space-y-3">
          <Field label="Category"><Select value={cat} onChange={(e) => setCat(e.target.value)}>{CATS.map((c) => <option key={c}>{c}</option>)}</Select></Field>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button>
            <Button onClick={async () => { if (await attempt(() => actions.setVideoCategory(edit!.id, cat), "Updated.")) setEdit(null); }}>Save</Button></div>
        </div>
      </Modal>
      <Modal open={!!hist} onClose={() => setHist(null)} title={`Posting history — ${hist?.filename ?? ""}`}>
        {hist && (history.filter((h) => h.videoId === hist.id).length === 0 ? <p className="text-sm text-slate-500">Never posted.</p> : (
          <ul className="space-y-1 text-sm">{history.filter((h) => h.videoId === hist.id).map((h) => <li key={h.id}>{pages.find((p) => p.id === h.pageId)?.name} — <StatusBadge status={h.status} /></li>)}</ul>
        ))}
      </Modal>
      <ConfirmModal open={!!del} onClose={() => setDel(null)} title="Delete media?" confirmLabel="Delete" message={`Remove ${del?.filename} from the library?`}
        onConfirm={() => { void attempt(() => actions.removeVideo(del!.id), "Removed."); }} />
    </>
  );
}
