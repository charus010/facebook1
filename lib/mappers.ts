/* Converts backend (snake_case, numeric ids) JSON into the frontend types. */
import type { Account, Caption, ErrorLog, FbPage, HistoryItem, Job, Video } from "./types";

const s = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n));

export const mapAccount = (a: any): Account => ({ id: s(a.id), name: a.name, email: a.email, status: a.status, lastSync: a.last_sync_at });
export const mapPage = (p: any): FbPage => ({
  id: s(p.id), fbId: p.fb_page_id, name: p.name, accountId: s(p.account_id), status: p.status, enabled: p.automation_enabled,
  dailyLimit: p.daily_limit, publishedToday: 0, lastSuccess: p.last_success_at, lastError: p.last_error, timezone: p.timezone,
});
export const mapVideo = (v: any): Video => ({
  id: s(v.id), filename: v.filename, sizeMb: Math.max(1, Math.round(v.size_bytes / 1048576)), status: v.status,
  category: v.category, uploadedAt: v.created_at, posts: 0, views: null,
});
export const mapCaption = (c: any): Caption => ({ id: s(c.id), title: c.title, description: c.description, category: c.category });
export const mapJob = (j: any): Job => ({ id: s(j.id), pageId: s(j.page_id), videoId: s(j.video_id), scheduledAt: j.scheduled_at, status: j.status });
export const mapHistory = (h: any): HistoryItem => ({
  id: s(h.id), pageId: s(h.page_id), videoId: s(h.video_id), publishedAt: h.published_at, status: "published", postId: h.fb_post_id, url: h.url,
});
export const mapError = (e: any): ErrorLog => ({ id: s(e.id), time: e.created_at, pageId: e.page_id === null ? null : s(e.page_id), code: e.code, message: e.message, severity: e.severity });
