"use client";
import { useStore } from "@/lib/store";
import { attempt } from "@/lib/api";
import { Button, EmptyState, PageHeader, PageSkeleton, StatusBadge, Table, Td, useMockLoad } from "@/components/ui";
import { fmt } from "@/lib/utils";

export default function Queue() {
  const loading = useMockLoad();
  const { jobs, pages, videos, actions, live } = useStore();
  if (loading) return <PageSkeleton />;
  const sorted = [...jobs].sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  return (
    <>
      <PageHeader title="Posting Queue" subtitle={live ? "Queued records only — nothing is sent to Facebook until Phase 4" : "Sample jobs — nothing is actually scheduled with Facebook"} />
      {sorted.length === 0 ? <EmptyState title="Queue is empty" hint="Scheduled jobs will appear here." /> : (
        <Table head={["Scheduled", "Page", "Video", "Status", "Actions"]}>
          {sorted.map((j) => (
            <tr key={j.id}>
              <Td>{fmt(j.scheduledAt)}</Td>
              <Td>{pages.find((p) => p.id === j.pageId)?.name}</Td>
              <Td>{videos.find((v) => v.id === j.videoId)?.filename}</Td>
              <Td><StatusBadge status={j.status} /></Td>
              <Td>
                {j.status === "failed" && <Button size="sm" variant="outline" onClick={() => attempt(() => actions.retryJob(j.id), "Job re-queued.")}>Retry</Button>}
                {j.status === "scheduled" && <Button size="sm" variant="danger" onClick={() => attempt(() => actions.cancelJob(j.id), "Job cancelled.")}>Cancel</Button>}
                {!["failed", "scheduled"].includes(j.status) && <span className="text-xs text-slate-400">—</span>}
              </Td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
