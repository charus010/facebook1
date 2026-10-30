"use client";
import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from "react";
import type { Account, FbPage, Video, Caption, Job, HistoryItem, ErrorLog } from "./types";
import { MOCK_ACCOUNTS, MOCK_PAGES, MOCK_VIDEOS, MOCK_CAPTIONS, MOCK_JOBS, MOCK_HISTORY, MOCK_ERRORS } from "./mock-data";

interface Settings { schedulerPaused: boolean; randomMode: "random" | "category"; noRepeatDays: number; }

interface Store {
  accounts: Account[]; pages: FbPage[]; videos: Video[]; captions: Caption[];
  jobs: Job[]; history: HistoryItem[]; errors: ErrorLog[]; settings: Settings;
  setAccounts: (f: (a: Account[]) => Account[]) => void;
  setPages: (f: (p: FbPage[]) => FbPage[]) => void;
  setVideos: (f: (v: Video[]) => Video[]) => void;
  setCaptions: (f: (c: Caption[]) => Caption[]) => void;
  setJobs: (f: (j: Job[]) => Job[]) => void;
  setSettings: (s: Partial<Settings>) => void;
  nextId: (prefix: string) => string;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [accounts, setAccounts] = useState(MOCK_ACCOUNTS);
  const [pages, setPages] = useState(MOCK_PAGES);
  const [videos, setVideos] = useState(MOCK_VIDEOS);
  const [captions, setCaptions] = useState(MOCK_CAPTIONS);
  const [jobs, setJobs] = useState(MOCK_JOBS);
  const [settings, setS] = useState<Settings>({ schedulerPaused: false, randomMode: "category", noRepeatDays: 14 });
  const counter = useRef(1000);
  const nextId = useCallback((prefix: string) => `${prefix}${++counter.current}`, []);

  return (
    <Ctx.Provider value={{
      accounts, pages, videos, captions, jobs, history: MOCK_HISTORY, errors: MOCK_ERRORS, settings,
      setAccounts, setPages, setVideos, setCaptions, setJobs,
      setSettings: (s) => setS((o) => ({ ...o, ...s })), nextId,
    }}>{children}</Ctx.Provider>
  );
}

export function useStore() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useStore must be used inside StoreProvider");
  return c;
}
