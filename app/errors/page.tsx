"use client";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { Badge, EmptyState, PageHeader, PageSkeleton, Select, Table, Td, useMockLoad } from "@/components/ui";
import { fmt } from "@/lib/utils";

export default function Errors() {
  const loading = useMockLoad();
  const { errors, pages } = useStore();
  const [sev, setSev] = useState("all");
  if (loading) return <PageSkeleton />;
  const list = errors.filter((e) => sev === "all" || e.severity === sev);
  return (
    <>
      <PageHeader title="Error Logs" subtitle="Sample entries. Secrets are never logged." />
      <Select aria-label="Filter by severity" value={sev} onChange={(e) => setSev(e.target.value)} className="mb-4 max-w-[180px]">
        <option value="all">all severities</option><option>error</option><option>warning</option>
      </Select>
      {list.length === 0 ? <EmptyState title="No errors" hint="Nothing to show for this filter." /> : (
        <Table head={["Time", "Page", "Code", "Message", "Severity"]}>
          {list.map((e) => (
            <tr key={e.id}><Td>{fmt(e.time)}</Td><Td>{pages.find((p) => p.id === e.pageId)?.name ?? "—"}</Td><Td className="font-mono text-xs">{e.code}</Td><Td>{e.message}</Td>
              <Td><Badge tone={e.severity === "error" ? "red" : "amber"}>{e.severity}</Badge></Td></tr>
          ))}
        </Table>
      )}
    </>
  );
}
