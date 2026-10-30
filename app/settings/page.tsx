"use client";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { useStore } from "@/lib/store";
import { attempt } from "@/lib/api";
import { Button, Card, Field, Input, PageHeader, PageSkeleton, Select, useMockLoad } from "@/components/ui";

export default function SettingsPage() {
  const loading = useMockLoad(300);
  const { settings, actions, live } = useStore();
  const { theme, setTheme } = useTheme();
  const [days, setDays] = useState(String(settings.noRepeatDays));
  useEffect(() => setDays(String(settings.noRepeatDays)), [settings.noRepeatDays]);
  if (loading) return <PageSkeleton />;

  function commitDays() {
    const n = Math.max(0, Math.min(365, Math.floor(Number(days) || 0)));
    setDays(String(n));
    if (n !== settings.noRepeatDays) void attempt(() => actions.saveSettings({ noRepeatDays: n }), "Saved.");
  }

  return (
    <>
      <PageHeader title="Settings" subtitle={live ? "Saved to the database" : "Sample settings (not persisted)"} />
      <div className="grid max-w-2xl gap-4">
        <Card>
          <h2 className="mb-3 font-semibold">Scheduler</h2>
          <Button variant={settings.schedulerPaused ? "primary" : "outline"}
            onClick={() => attempt(() => actions.saveSettings({ schedulerPaused: !settings.schedulerPaused }), settings.schedulerPaused ? "Scheduler resumed." : "Scheduler paused.")}>
            {settings.schedulerPaused ? "Resume scheduler" : "Pause scheduler"}
          </Button>
          {live && <p className="mt-2 text-xs text-slate-500">The scheduler worker itself arrives in Phase 4; this stores the on/off setting.</p>}
        </Card>
        <Card className="space-y-3">
          <h2 className="font-semibold">Caption selection</h2>
          <Field label="Mode"><Select value={settings.randomMode} onChange={(e) => void attempt(() => actions.saveSettings({ randomMode: e.target.value as "random" | "category" }), "Saved.")}><option value="random">Fully random</option><option value="category">Match video category</option></Select></Field>
          <Field label="Don't repeat a caption within (days)"><Input type="number" min={0} max={365} value={days} onChange={(e) => setDays(e.target.value)} onBlur={commitDays} /></Field>
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold">Appearance</h2>
          <Select aria-label="Theme" value={theme} onChange={(e) => setTheme(e.target.value)}><option value="light">Light</option><option value="dark">Dark</option></Select>
        </Card>
        <Card><h2 className="mb-1 font-semibold">Mode</h2><p className="text-sm text-slate-500">{live ? "Connected to the backend API. Real publishing is not implemented yet." : "Demo mode only. Real publishing is not implemented."}</p></Card>
      </div>
    </>
  );
}
