"use client";
import { toast } from "sonner";

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");
/** true when a backend URL is configured; false = sample-data demo mode (nothing is sent anywhere). */
export const LIVE = API_URL !== "";

const KEY = "fbva_token";
export const getToken = (): string | null => (typeof window === "undefined" ? null : sessionStorage.getItem(KEY));
export const setToken = (t: string | null) => {
  if (typeof window === "undefined") return;
  if (t) sessionStorage.setItem(KEY, t); else sessionStorage.removeItem(KEY);
};

export class ApiError extends Error {
  constructor(message: string, public code: string, public status: number) { super(message); }
}
export const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong.");

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown; form?: FormData } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  const t = getToken();
  if (t) headers.Authorization = `Bearer ${t}`;
  let body: BodyInit | undefined;
  if (opts.form) body = opts.form;
  else if (opts.body !== undefined) { headers["Content-Type"] = "application/json"; body = JSON.stringify(opts.body); }
  let res: Response;
  try {
    res = await fetch(API_URL + path, { method: opts.method ?? "GET", headers, body });
  } catch {
    throw new ApiError("Cannot reach the server. Check the API URL, HTTPS and CORS settings.", "NETWORK", 0);
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && path !== "/api/auth/login") { setToken(null); window.dispatchEvent(new Event("auth-expired")); }
    const e = data?.error;
    const msg = e?.code === "VALIDATION_ERROR" && Array.isArray(e.details)
      ? e.details.map((d: { field: string; message: string }) => `${d.field}: ${d.message}`).join("; ")
      : e?.message ?? "Request failed.";
    throw new ApiError(msg, e?.code ?? "ERROR", res.status);
  }
  return data as T;
}

/** Fetches every page of a paginated list endpoint. */
export async function listAll<T = any>(path: string): Promise<T[]> {
  const out: T[] = [];
  for (let page = 1; page < 100; page++) {
    const r = await api<{ items: T[]; total: number }>(`${path}${path.includes("?") ? "&" : "?"}page=${page}&page_size=100`);
    out.push(...r.items);
    if (out.length >= r.total || r.items.length === 0) break;
  }
  return out;
}

/** Runs an action, shows a success or error toast, returns whether it worked. */
export async function attempt(fn: () => Promise<unknown>, okMsg?: string): Promise<boolean> {
  try { await fn(); if (okMsg) toast.success(okMsg); return true; }
  catch (e) { toast.error(errMsg(e)); return false; }
}
