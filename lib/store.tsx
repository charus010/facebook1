"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Account, Caption, ErrorLog, FbPage, HistoryItem, Job, MediaMode, Video } from "./types";
import { MOCK_ACCOUNTS, MOCK_CAPTIONS, MOCK_ERRORS, MOCK_HISTORY, MOCK_JOBS, MOCK_PAGES, MOCK_VIDEOS } from "./mock-data";
import { LIVE, api, errMsg, getToken, listAll, setToken } from "./api";
import { mapAccount, mapCaption, mapError, mapHistory, mapJob, mapPage, mapVideo } from "./mappers";

export interface Settings { schedulerPaused: boolean; randomMode: "random" | "category"; noRepeatDays: number }
export interface CaptionInput { title: string; description: string; category: string }
export interface ImportSummary { valid: number; imported: number; duplicates: number; invalid: string[] }
type Auth = "checking" | "anon" | "authed";

interface Actions {
  addAccount(name: string, email: string): Promise<Account>;
  removeAccount(id: string): Promise<void>;
  reauthorizeAccount(id: string): Promise<void>; // demo only
  updatePageLimit(id: string, limit: number): Promise<void>;
  togglePage(id: string): Promise<void>;
  reconnectPage(id: string): Promise<void>; // demo only
  uploadMedia(files: File[]): Promise<{ added: number; errors: string[] }>;
  updatePageMedia(id: string, mode: MediaMode, imagePercent: number): Promise<void>;
  setVideoCategory(id: string, category: string): Promise<void>;
  removeVideo(id: string): Promise<void>;
  saveCaption(id: string | null, data: CaptionInput): Promise<void>;
  removeCaption(id: string): Promise<void>;
  importCaptionRows(rows: CaptionInput[]): Promise<void>; // demo only
  importCaptionFile(file: File, dryRun: boolean): Promise<ImportSummary>; // live only
  cancelJob(id: string): Promise<void>;
  retryJob(id: string): Promise<void>;
  saveSettings(patch: Partial<Settings>): Promise<void>;
}

interface Store {
  live: boolean; auth: Auth; loading: boolean; loadError: string | null;
  accounts: Account[]; pages: FbPage[]; videos: Video[]; captions: Caption[];
  jobs: Job[]; history: HistoryItem[]; errors: ErrorLog[]; settings: Settings;
  actions: Actions; refresh: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>; logout: () => void;
  setPages: (f: (p: FbPage[]) => FbPage[]) => void; // used by the demo-only discovery dialog
  nextId: (prefix: string) => string;
}

const Ctx = createContext<Store | null>(null);
const MAX_VIDEO = 2 * 1024 ** 3;
const MAX_IMAGE = 10 * 1024 ** 2;
const IMAGE_TYPES = ["image/jpeg", "image/png"];

export function StoreProvider({ children }: { children: ReactNode }) {
  const [accounts, setAccounts] = useState<Account[]>(LIVE ? [] : MOCK_ACCOUNTS);
  const [pages, setPages] = useState<FbPage[]>(LIVE ? [] : MOCK_PAGES);
  const [videos, setVideos] = useState<Video[]>(LIVE ? [] : MOCK_VIDEOS);
  const [captions, setCaptions] = useState<Caption[]>(LIVE ? [] : MOCK_CAPTIONS);
  const [jobs, setJobs] = useState<Job[]>(LIVE ? [] : MOCK_JOBS);
  const [history, setHistory] = useState<HistoryItem[]>(LIVE ? [] : MOCK_HISTORY);
  const [errors, setErrors] = useState<ErrorLog[]>(LIVE ? [] : MOCK_ERRORS);
  const [settings, setSettings] = useState<Settings>({ schedulerPaused: false, randomMode: "category", noRepeatDays: 14 });
  const [auth, setAuth] = useState<Auth>(LIVE ? "checking" : "authed");
  const [loaded, setLoaded] = useState(!LIVE);
  const [loadError, setLoadError] = useState<string | null>(null);
  const counter = useRef(1000);
  const nextId = useCallback((p: string) => `${p}${++counter.current}`, []);

  const refresh = useCallback(async () => {
    if (!LIVE) return;
    try {
      const [acc, pg, vid, cap, job, his, err, set] = await Promise.all([
        listAll("/api/accounts"), listAll("/api/pages"), listAll("/api/media"), listAll("/api/captions"),
        listAll("/api/queue"), listAll("/api/history"), listAll("/api/errors"), api<Record<string, string>>("/api/settings"),
      ]);
      const hist = his.map(mapHistory);
      const today = new Date().toISOString().slice(0, 10);
      setAccounts(acc.map(mapAccount));
      setPages(pg.map(mapPage).map((p) => ({ ...p, publishedToday: hist.filter((h) => h.pageId === p.id && h.publishedAt.slice(0, 10) === today).length })));
      setVideos(vid.map(mapVideo).map((v) => ({ ...v, posts: hist.filter((h) => h.videoId === v.id).length })));
      setCaptions(cap.map(mapCaption));
      setJobs(job.map(mapJob));
      setHistory(hist);
      setErrors(err.map(mapError));
      setSettings({ schedulerPaused: set.scheduler_paused === "true", randomMode: set.caption_selection_mode === "random" ? "random" : "category", noRepeatDays: Number(set.caption_no_repeat_days) || 0 });
      setLoadError(null);
    } catch (e) {
      setLoadError(errMsg(e));
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!LIVE) return;
    const onExpired = () => setAuth("anon");
    window.addEventListener("auth-expired", onExpired);
    if (!getToken()) setAuth("anon");
    else api("/api/auth/me").then(() => setAuth("authed")).catch(() => setAuth("anon"));
    return () => window.removeEventListener("auth-expired", onExpired);
  }, []);
  useEffect(() => { if (LIVE && auth === "authed") void refresh(); }, [auth, refresh]);

  const login = async (email: string, password: string) => {
    const r = await api<{ access_token: string }>("/api/auth/login", { method: "POST", body: { email, password } });
    setToken(r.access_token);
    setLoaded(false);
    setAuth("authed");
  };
  const logout = () => {
    api("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    setToken(null);
    setAccounts([]); setPages([]); setVideos([]); setCaptions([]); setJobs([]); setHistory([]); setErrors([]);
    setAuth("anon");
  };

  const live = async (fn: () => Promise<unknown>) => { await fn(); await refresh(); };
  const patch = <T extends { id: string }>(set: (f: (x: T[]) => T[]) => void, id: string, p: Partial<T>) => set((x) => x.map((i) => (i.id === id ? { ...i, ...p } : i)));

  const actions: Actions = {
    async addAccount(name, email) {
      if (LIVE) { const r = await api("/api/accounts", { method: "POST", body: { name, email } }); await refresh(); return mapAccount(r); }
      const acc: Account = { id: nextId("a"), name, email, status: "connected", lastSync: "2026-10-30T12:00:00Z" };
      setAccounts((a) => [...a, acc]);
      return acc;
    },
    async removeAccount(id) {
      if (LIVE) return live(() => api(`/api/accounts/${id}`, { method: "DELETE" }));
      setAccounts((x) => x.filter((a) => a.id !== id)); setPages((x) => x.filter((p) => p.accountId !== id));
    },
    async reauthorizeAccount(id) { patch(setAccounts, id, { status: "connected", lastSync: "2026-10-30T12:00:00Z" }); },
    async updatePageLimit(id, limit) {
      if (LIVE) return live(() => api(`/api/pages/${id}`, { method: "PATCH", body: { daily_limit: limit } }));
      patch(setPages, id, { dailyLimit: limit });
    },
    async togglePage(id) {
      const p = pages.find((x) => x.id === id);
      if (LIVE) return live(() => api(`/api/pages/${id}/${p?.enabled ? "pause" : "resume"}`, { method: "POST" }));
      patch(setPages, id, { enabled: !p?.enabled });
    },
    async reconnectPage(id) { patch(setPages, id, { status: "connected", lastError: null }); },
    async updatePageMedia(id, mode, imagePercent) {
      if (LIVE) return live(() => api(`/api/pages/${id}`, { method: "PATCH", body: { media_mode: mode, image_percent: imagePercent } }));
      patch(setPages, id, { mediaMode: mode, imagePercent });
    },
    async uploadMedia(files) {
      let added = 0; const errs: string[] = [];
      for (const f of files) {
        const kind = f.type.startsWith("video/") ? "video" : IMAGE_TYPES.includes(f.type) ? "image" : null;
        if (!kind) { errs.push(`${f.name}: use an MP4/MOV/M4V video or a JPG/PNG image.`); continue; }
        if (f.size > (kind === "video" ? MAX_VIDEO : MAX_IMAGE)) { errs.push(`${f.name}: larger than ${kind === "video" ? "2 GB" : "10 MB"}.`); continue; }
        try {
          if (LIVE) {
            const r = await api("/api/media/upload-url", { method: "POST", body: { filename: f.name, size_bytes: f.size, content_type: f.type } });
            const put = await fetch(r.upload_url, { method: r.method, headers: r.headers, body: f }).catch(() => null);
            if (!put || !put.ok) throw new Error("upload to storage failed (check bucket CORS)");
            await api(`/api/media/${r.video.id}/complete`, { method: "POST" });
          } else {
            setVideos((v) => [{ id: nextId("v"), filename: f.name, mediaType: kind, sizeMb: Math.max(1, Math.round(f.size / 1048576)), status: "ready", category: "General", uploadedAt: "2026-10-30T12:00:00Z", posts: 0, views: null }, ...v]);
          }
          added++;
        } catch (e) { errs.push(`${f.name}: ${errMsg(e)}`); }
      }
      if (LIVE) await refresh();
      return { added, errors: errs };
    },
    async setVideoCategory(id, category) {
      if (LIVE) return live(() => api(`/api/media/${id}`, { method: "PATCH", body: { category } }));
      patch(setVideos, id, { category });
    },
    async removeVideo(id) {
      if (LIVE) return live(() => api(`/api/media/${id}`, { method: "DELETE" }));
      setVideos((x) => x.filter((v) => v.id !== id));
    },
    async saveCaption(id, data) {
      if (LIVE) return live(() => (id ? api(`/api/captions/${id}`, { method: "PATCH", body: data }) : api("/api/captions", { method: "POST", body: data })));
      if (id) patch(setCaptions, id, data); else setCaptions((x) => [...x, { id: nextId("c"), ...data }]);
    },
    async removeCaption(id) {
      if (LIVE) return live(() => api(`/api/captions/${id}`, { method: "DELETE" }));
      setCaptions((x) => x.filter((c) => c.id !== id));
    },
    async importCaptionRows(rows) { setCaptions((x) => [...x, ...rows.map((r) => ({ id: nextId("c"), ...r }))]); },
    async importCaptionFile(file, dryRun) {
      const fd = new FormData(); fd.append("file", file);
      const r = await api<ImportSummary>(`/api/captions/import?dry_run=${dryRun}`, { method: "POST", form: fd });
      if (!dryRun) await refresh();
      return r;
    },
    async cancelJob(id) {
      if (LIVE) return live(() => api(`/api/queue/${id}/cancel`, { method: "POST" }));
      patch(setJobs, id, { status: "cancelled" });
    },
    async retryJob(id) {
      if (LIVE) return live(() => api(`/api/queue/${id}/retry`, { method: "POST" }));
      patch(setJobs, id, { status: "scheduled" });
    },
    async saveSettings(p) {
      if (LIVE) {
        const map: Record<string, [string, string]> = {
          schedulerPaused: ["scheduler_paused", String(p.schedulerPaused)],
          randomMode: ["caption_selection_mode", String(p.randomMode)],
          noRepeatDays: ["caption_no_repeat_days", String(p.noRepeatDays)],
        };
        for (const k of Object.keys(p)) await api(`/api/settings/${map[k][0]}`, { method: "PUT", body: { value: map[k][1] } });
      }
      setSettings((o) => ({ ...o, ...p }));
    },
  };

  return (
    <Ctx.Provider value={{ live: LIVE, auth, loading: !loaded, loadError, accounts, pages, videos, captions, jobs, history, errors, settings, actions, refresh, login, logout, setPages, nextId }}>
      {children}
    </Ctx.Provider>
  );
}

export function useStore() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useStore must be used inside StoreProvider");
  return c;
}
