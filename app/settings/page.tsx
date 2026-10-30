"use client";
import { toast } from "sonner";
import { useTheme } from "next-themes";
import { useStore } from "@/lib/store";
import { Button, Card, Field, Input, PageHeader, PageSkeleton, Select, useMockLoad } from "@/components/ui";

export default function SettingsPage() {
  const loading = useMockLoad(300);
  const { settings, setSettings } = useStore();
  const { theme, setTheme } = useTheme();
  if (loading) return <PageSkeleton />;
  return (
    <>
      <PageHeader title="Settings" subtitle="Sample settings (not persisted in Phase 1)" />
      <div className="grid max-w-2xl gap-4">
        <Card>
          <h2 className="mb-3 font-semibold">Scheduler</h2>
          <Button variant={settings.schedulerPaused ? "primary" : "outline"} onClick={() => { setSettings({ schedulerPaused: !settings.schedulerPaused }); toast.success(settings.schedulerPaused ? "Scheduler resumed (sample)." : "Scheduler paused (sample)."); }}>
            {settings.schedulerPaused ? "Resume scheduler" : "Pause scheduler"}
          </Button>
        </Card>
        <Card className="space-y-3">
          <h2 className="font-semibold">Caption selection</h2>
          <Field label="Mode"><Select value={settings.randomMode} onChange={(e) => setSettings({ randomMode: e.target.value as "random" | "category" })}><option value="random">Fully random</option><option value="category">Match video category</option></Select></Field>
          <Field label="Don't repeat a caption within (days)"><Input type="number" min={0} max={365} value={settings.noRepeatDays} onChange={(e) => setSettings({ noRepeatDays: Math.max(0, Math.min(365, Number(e.target.value) || 0)) })} /></Field>
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold">Appearance</h2>
          <Select aria-label="Theme" value={theme} onChange={(e) => setTheme(e.target.value)}><option value="light">Light</option><option value="dark">Dark</option></Select>
        </Card>
        <Card><h2 className="mb-1 font-semibold">Mode</h2><p className="text-sm text-slate-500">Demo mode only. Real publishing is not implemented in this phase.</p></Card>
      </div>
    </>
  );
}
