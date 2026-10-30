"use client";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useStore } from "@/lib/store";
import { MOCK_DAILY, MOCK_PAGE_STATS } from "@/lib/mock-data";
import { Card, PageHeader, PageSkeleton, Select, StatCard, Table, Td, useMockLoad } from "@/components/ui";
import { fmt } from "@/lib/utils";

const NA = "Not available";
export default function Analytics() {
  const loading = useMockLoad();
  const { pages, videos } = useStore();
  const [days, setDays] = useState(14);
  if (loading) return <PageSkeleton />;
  const data = MOCK_DAILY.slice(-days);
  const sum = (k: "comments" | "reactions") => data.reduce((s, d) => s + d[k], 0);
  const knownViews = data.filter((d) => d.views !== null);
  const top = [...videos].filter((v) => v.views !== null).sort((a, b) => (b.views ?? 0) - (a.views ?? 0)).slice(0, 5);
  return (
    <>
      <PageHeader title="Analytics" subtitle={`SAMPLE data, not from Meta. Last refresh: ${fmt("2026-10-30T08:00:00Z")}. Meta metrics may be delayed.`}
        actions={<Select aria-label="Date range" value={days} onChange={(e) => setDays(Number(e.target.value))}><option value={7}>Last 7 days</option><option value={14}>Last 14 days</option><option value={30}>Last 30 days</option></Select>} />
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Views (days with data)" value={knownViews.length ? knownViews.reduce((s, d) => s + (d.views ?? 0), 0).toLocaleString("en-US") : NA} />
        <StatCard label="Comments" value={sum("comments").toLocaleString("en-US")} />
        <StatCard label="Reactions" value={sum("reactions").toLocaleString("en-US")} />
      </div>
      <p className="mt-2 text-xs text-slate-500">Days where views are unavailable are left blank in the chart — they are not counted as zero.</p>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-2 font-semibold">Views per day</h2>
          <div className="h-64" role="img" aria-label="Line chart of sample views per day">
            <ResponsiveContainer><LineChart data={data}><CartesianGrid strokeDasharray="3 3" opacity={0.3} /><XAxis dataKey="date" tickFormatter={(d: string) => d.slice(5)} fontSize={11} /><YAxis fontSize={11} /><Tooltip /><Line type="monotone" dataKey="views" stroke="#2563eb" connectNulls={false} name="Views" /></LineChart></ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <h2 className="mb-2 font-semibold">Comments & reactions</h2>
          <div className="h-64" role="img" aria-label="Bar chart of sample comments and reactions per day">
            <ResponsiveContainer><BarChart data={data}><CartesianGrid strokeDasharray="3 3" opacity={0.3} /><XAxis dataKey="date" tickFormatter={(d: string) => d.slice(5)} fontSize={11} /><YAxis fontSize={11} /><Tooltip /><Legend /><Bar dataKey="comments" fill="#16a34a" name="Comments" /><Bar dataKey="reactions" fill="#f59e0b" name="Reactions" /></BarChart></ResponsiveContainer>
          </div>
        </Card>
      </div>
      <h2 className="mb-2 mt-6 font-semibold">Page comparison</h2>
      <Table head={["Page", "Views", "Comments", "Reactions"]}>
        {MOCK_PAGE_STATS.map((s) => (
          <tr key={s.pageId}><Td>{pages.find((p) => p.id === s.pageId)?.name ?? s.pageId}</Td><Td>{s.views === null ? NA : s.views.toLocaleString("en-US")}</Td><Td>{s.comments}</Td><Td>{s.reactions}</Td></tr>
        ))}
      </Table>
      <h2 className="mb-2 mt-6 font-semibold">Top-performing videos</h2>
      <Table head={["Video", "Views", "Posts"]}>
        {top.map((v) => <tr key={v.id}><Td>{v.filename}</Td><Td>{v.views?.toLocaleString("en-US")}</Td><Td>{v.posts}</Td></tr>)}
      </Table>
    </>
  );
}
