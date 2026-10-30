// ⚠️ SAMPLE ONLY — simulates what Meta's Graph API will return in Phase 3.
export interface Discovered { fbId: string; name: string; canPublish: boolean }

export function discoverPages(accountId: string, accountName: string): Discovered[] {
  if (accountId === "a1") {
    return [
      { fbId: "1000000000001", name: "Sample Page One", canPublish: true },
      { fbId: "1000000000002", name: "Sample Page Two", canPublish: true },
      { fbId: "1000000000011", name: "Sample Page Six (new)", canPublish: true },
    ];
  }
  return Array.from({ length: 3 }, (_, i) => ({
    fbId: `sample-${accountId}-${i + 1}`,
    name: `${accountName} · Sample Page ${i + 1}`,
    canPublish: i !== 2,
  }));
}
