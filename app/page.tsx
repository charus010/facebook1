"use client";
import Link from "next/link";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useStore } from "@/lib/store";
import { MOCK_DAILY } from "@/lib/mock-data";
import { Card, PageHeader, PageSkeleton, StatCard, StatusBadge, useMockLoad, Table, Td } from "@/components/ui";
import { fmt } from "@/lib/utils";

export default function Overview() {
  const loading = useMockLoad();
  const { accounts, pages, videos, jobs, history, settings, live } = useStore();
  if (loading) return <PageSkeleton />;
  const attention = pages.filter((p) => p.status !== "connected");
  const stats: [string, number, ("red" | "amber")?][] = [
    ["Connected accounts", accounts.filter((a) => a.status === "connected").length],
    ["Connected pages", pages.filter((p) => p.status === "connected").length],
    ["Active pages", pages.filter((p) => p.enabled).length],
    ["Total videos", videos.length],
    ["Posts published today", pages.reduce((s, p) => s + p.publishedToday, 0)],
    ["Scheduled posts", jobs.filter((j) => j.status === "scheduled").length],
    ["Failed posts", jobs.filter((j) => j.status === "failed").length, "red"],
    ["Pages needing attention", attention.length, "amber"],
  ];
  return (
    <>
      <PageHeader title="Overview" subtitle={`${settings.schedulerPaused ? "Scheduler is PAUSED" : "Scheduler setting: running"}${live ? "" : " (sample)"}`} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{stats.map(([l, v, t]) => <StatCard key={l} label={l} value={v} tone={t} />)}</div>
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {live ? <Card className="lg:col-span-2"><p className="text-sm text-slate-500">Charts will appear here once real publishing data exists (Phase 4).</p></Card> : (
        <Card className="lg:col-span-2">
          <h2 className="mb-2 font-semibold">Posts per day (sample data)</h2>
          <div className="h-64" role="img" aria-label="Bar chart of sample published and failed posts per day">
            <ResponsiveContainer>
              <BarChart data={MOCK_DAILY.slice(-14)}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="date" tickFormatter={(d: string) => d.slice(5)} fontSize={11} />
                <YAxis allowDecimals={false} fontSize={11} />
                <Tooltip />
                <Bar dataKey="published" fill="#2563eb" name="Published" />
                <Bar dataKey="failed" fill="#dc2626" name="Failed" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        )}
        <Card>
          <h2 className="mb-2 font-semibold">Pages requiring attention</h2>
          {attention.length === 0 ? <p className="text-sm text-slate-500">All pages healthy.</p> : (
            <ul className="space-y-2 text-sm">
              {attention.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2"><span>{p.name}</span><StatusBadge status={p.status} /></li>
              ))}
            </ul>
          )}
          <Link href="/pages" className="mt-3 inline-block text-sm text-blue-600 underline">Manage pages</Link>
        </Card>
      </div>
      <h2 className="mb-2 mt-6 font-semibold">Recent publishing activity{live ? "" : " (sample)"}</h2>
      <Table head={["Time", "Page", "Video", "Status"]}>
        {history.slice(0, 5).map((h) => (
          <tr key={h.id}>
            <Td>{fmt(h.publishedAt)}</Td>
            <Td>{pages.find((p) => p.id === h.pageId)?.name}</Td>
            <Td>{videos.find((v) => v.id === h.videoId)?.filename}</Td>
            <Td><StatusBadge status={h.status} /></Td>
          </tr>
        ))}
      </Table>
    </>
  );
}
