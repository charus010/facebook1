"use client";
import { useStore } from "@/lib/store";
import { EmptyState, PageHeader, PageSkeleton, StatusBadge, Table, Td, useMockLoad } from "@/components/ui";
import { fmt } from "@/lib/utils";

export default function HistoryPage() {
  const loading = useMockLoad();
  const { history, pages, videos, live } = useStore();
  if (loading) return <PageSkeleton />;
  return (
    <>
      <PageHeader title="Posting History" subtitle={live ? "Real post IDs and links appear here after publishing (Phase 4)." : "Sample records. Real post IDs and links appear after Phase 4."} />
      {history.length === 0 ? <EmptyState title="No history yet" hint="Published posts will be listed here." /> : (
        <Table head={["Time", "Page", "Video", "Status", "Post ID", "Link"]}>
          {history.map((h) => (
            <tr key={h.id}>
              <Td>{fmt(h.publishedAt)}</Td>
              <Td>{pages.find((p) => p.id === h.pageId)?.name}</Td>
              <Td>{videos.find((v) => v.id === h.videoId)?.filename}</Td>
              <Td><StatusBadge status={h.status} /></Td>
              <Td>{h.postId ?? "—"}</Td>
              <Td>{h.url ?? "n/a (sample)"}</Td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
