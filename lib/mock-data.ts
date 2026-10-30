// ⚠️ SAMPLE DATA ONLY — none of these values come from Facebook or Meta.
import type { Account, FbPage, Video, Caption, Job, HistoryItem, ErrorLog, DailyStat, PageStat } from "./types";

export const MOCK_ACCOUNTS: Account[] = [
  { id: "a1", name: "Sample Account Alpha", email: "alpha@example.com", status: "connected", lastSync: "2026-10-30T08:10:00Z" },
  { id: "a2", name: "Sample Account Beta", email: "beta@example.com", status: "needs_reauth", lastSync: "2026-10-27T14:30:00Z" },
  { id: "a3", name: "Sample Account Gamma", email: "gamma@example.com", status: "connected", lastSync: "2026-10-30T07:45:00Z" },
];

export const MOCK_PAGES: FbPage[] = [
  { id: "p1", fbId: "1000000000001", name: "Sample Page One", accountId: "a1", status: "connected", enabled: true, dailyLimit: 3, publishedToday: 2, lastSuccess: "2026-10-30T06:00:00Z", lastError: null, timezone: "Asia/Karachi" },
  { id: "p2", fbId: "1000000000002", name: "Sample Page Two", accountId: "a1", status: "connected", enabled: true, dailyLimit: 2, publishedToday: 2, lastSuccess: "2026-10-30T05:00:00Z", lastError: null, timezone: "Asia/Karachi" },
  { id: "p3", fbId: "1000000000003", name: "Sample Page Three", accountId: "a2", status: "needs_reauth", enabled: false, dailyLimit: 3, publishedToday: 0, lastSuccess: "2026-10-26T09:00:00Z", lastError: "Token expired (sample error)", timezone: "UTC" },
  { id: "p4", fbId: "1000000000004", name: "Sample Page Four", accountId: "a3", status: "needs_attention", enabled: true, dailyLimit: 4, publishedToday: 1, lastSuccess: "2026-10-29T18:00:00Z", lastError: "Missing publish permission (sample error)", timezone: "Europe/London" },
  { id: "p5", fbId: "1000000000005", name: "Sample Page Five", accountId: "a3", status: "connected", enabled: false, dailyLimit: 2, publishedToday: 0, lastSuccess: null, lastError: null, timezone: "America/New_York" },
];

const cats = ["Travel", "Food", "Fitness", "Tech"];
export const MOCK_VIDEOS: Video[] = Array.from({ length: 12 }, (_, i) => ({
  id: `v${i + 1}`,
  filename: `sample-video-${String(i + 1).padStart(2, "0")}.mp4`,
  sizeMb: 20 + ((i * 37) % 180),
  status: i === 10 ? "processing" : i === 11 ? "failed" : "ready",
  category: cats[i % 4],
  uploadedAt: `2026-10-${String(10 + i).padStart(2, "0")}T10:00:00Z`,
  posts: i % 5,
  views: i % 3 === 2 ? null : 800 + i * 345,
}));

export const MOCK_CAPTIONS: Caption[] = Array.from({ length: 10 }, (_, i) => ({
  id: `c${i + 1}`,
  title: `Sample title ${i + 1}`,
  description: `Sample description text number ${i + 1}. Replace with your own.`,
  category: cats[i % 4],
}));

export const MOCK_JOBS: Job[] = [
  { id: "j1", pageId: "p1", videoId: "v1", scheduledAt: "2026-10-30T12:00:00Z", status: "scheduled" },
  { id: "j2", pageId: "p2", videoId: "v2", scheduledAt: "2026-10-30T13:30:00Z", status: "scheduled" },
  { id: "j3", pageId: "p4", videoId: "v3", scheduledAt: "2026-10-30T09:00:00Z", status: "failed" },
  { id: "j4", pageId: "p1", videoId: "v4", scheduledAt: "2026-10-31T08:00:00Z", status: "scheduled" },
  { id: "j5", pageId: "p2", videoId: "v5", scheduledAt: "2026-10-30T07:00:00Z", status: "running" },
];

export const MOCK_HISTORY: HistoryItem[] = [
  { id: "h1", pageId: "p1", videoId: "v6", publishedAt: "2026-10-30T06:00:00Z", status: "published", postId: "sample_post_001", url: null },
  { id: "h2", pageId: "p2", videoId: "v7", publishedAt: "2026-10-30T05:00:00Z", status: "published", postId: "sample_post_002", url: null },
  { id: "h3", pageId: "p4", videoId: "v8", publishedAt: "2026-10-30T04:00:00Z", status: "failed", postId: null, url: null },
  { id: "h4", pageId: "p1", videoId: "v9", publishedAt: "2026-10-29T18:00:00Z", status: "published", postId: "sample_post_003", url: null },
  { id: "h5", pageId: "p3", videoId: "v1", publishedAt: "2026-10-26T09:00:00Z", status: "published", postId: "sample_post_004", url: null },
];

export const MOCK_ERRORS: ErrorLog[] = [
  { id: "e1", time: "2026-10-30T04:00:00Z", pageId: "p4", code: "PERMISSION_MISSING", message: "Sample: Page publish permission not granted.", severity: "error" },
  { id: "e2", time: "2026-10-27T14:30:00Z", pageId: "p3", code: "TOKEN_EXPIRED", message: "Sample: authorization expired, reconnect required.", severity: "error" },
  { id: "e3", time: "2026-10-29T11:00:00Z", pageId: "p1", code: "RATE_LIMITED", message: "Sample: retry scheduled with backoff.", severity: "warning" },
];

export const MOCK_DAILY: DailyStat[] = Array.from({ length: 30 }, (_, i) => {
  const d = new Date(Date.UTC(2026, 9, 1 + i)).toISOString().slice(0, 10);
  return {
    date: d,
    published: 3 + ((i * 7) % 6),
    failed: i % 6 === 0 ? 1 : 0,
    views: i % 9 === 4 ? null : 1200 + ((i * 523) % 2400),
    comments: 20 + ((i * 11) % 40),
    reactions: 90 + ((i * 29) % 160),
  };
});

export const MOCK_PAGE_STATS: PageStat[] = [
  { pageId: "p1", views: 18400, comments: 310, reactions: 1450 },
  { pageId: "p2", views: 12100, comments: 205, reactions: 980 },
  { pageId: "p3", views: null, comments: 40, reactions: 210 },
  { pageId: "p4", views: 7300, comments: 98, reactions: 530 },
  { pageId: "p5", views: null, comments: 0, reactions: 0 },
];
