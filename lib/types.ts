export type AccountStatus = "connected" | "needs_reauth" | "disconnected";
export type PageStatus = "connected" | "needs_reauth" | "needs_attention";
export type JobStatus = "scheduled" | "running" | "failed" | "cancelled" | "published";
export type VideoStatus = "ready" | "uploading" | "processing" | "failed";

export interface Account { id: string; name: string; email: string; status: AccountStatus; lastSync: string | null; }
export interface FbPage {
  id: string; fbId: string; name: string; accountId: string; status: PageStatus;
  enabled: boolean; dailyLimit: number; publishedToday: number;
  lastSuccess: string | null; lastError: string | null; timezone: string;
}
export interface Video {
  id: string; filename: string; sizeMb: number; status: VideoStatus;
  category: string; uploadedAt: string; posts: number; views: number | null;
}
export interface Caption { id: string; title: string; description: string; category: string; }
export interface Job { id: string; pageId: string; videoId: string; scheduledAt: string; status: JobStatus; }
export interface HistoryItem {
  id: string; pageId: string; videoId: string; publishedAt: string;
  status: "published" | "failed"; postId: string | null; url: string | null;
}
export interface ErrorLog { id: string; time: string; pageId: string | null; code: string; message: string; severity: "warning" | "error"; }
export interface DailyStat { date: string; published: number; failed: number; views: number | null; comments: number; reactions: number; }
export interface PageStat { pageId: string; views: number | null; comments: number; reactions: number; }
