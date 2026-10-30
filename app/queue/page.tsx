"use client";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { Button, EmptyState, PageHeader, PageSkeleton, StatusBadge, Table, Td, useMockLoad } from "@/components/ui";
import { fmt } from "@/lib/utils";

export default function Queue() {
  const loading = useMockLoad();
  const { jobs, setJobs, pages, videos } = useStore();
  if (loading) return <PageSkeleton />;
  const set = (id: string, status: "scheduled" | "cancelled") => setJobs((x) => x.map((j) => (j.id === id ? { ...j, status } : j)));
  const sorted = [...jobs].sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  return (
    <>
      <PageHeader title="Posting Queue" subtitle="Sample jobs — nothing is actually scheduled with Facebook" />
      {sorted.length === 0 ? <EmptyState title="Queue is empty" hint="Scheduled jobs will appear here." /> : (
        <Table head={["Scheduled", "Page", "Video", "Status", "Actions"]}>
          {sorted.map((j) => (
            <tr key={j.id}>
              <Td>{fmt(j.scheduledAt)}</Td>
              <Td>{pages.find((p) => p.id === j.pageId)?.name}</Td>
              <Td>{videos.find((v) => v.id === j.videoId)?.filename}</Td>
              <Td><StatusBadge status={j.status} /></Td>
              <Td>
                {j.status === "failed" && <Button size="sm" variant="outline" onClick={() => { set(j.id, "scheduled"); toast.success("Job re-queued (sample)."); }}>Retry</Button>}
                {j.status === "scheduled" && <Button size="sm" variant="danger" onClick={() => { set(j.id, "cancelled"); toast.success("Job cancelled."); }}>Cancel</Button>}
                {!["failed", "scheduled"].includes(j.status) && <span className="text-xs text-slate-400">—</span>}
              </Td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
