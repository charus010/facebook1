"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useTheme } from "next-themes";
import { LayoutDashboard, Users, Flag, Film, Type, ListTodo, History, BarChart3, AlertTriangle, Settings, Menu, Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/accounts", label: "Accounts", icon: Users },
  { href: "/pages", label: "Facebook Pages", icon: Flag },
  { href: "/videos", label: "Video Library", icon: Film },
  { href: "/captions", label: "Titles & Descriptions", icon: Type },
  { href: "/queue", label: "Posting Queue", icon: ListTodo },
  { href: "/history", label: "Posting History", icon: History },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/errors", label: "Error Logs", icon: AlertTriangle },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Shell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <div className="min-h-screen lg:flex">
      <aside className={cn("fixed inset-y-0 left-0 z-40 w-60 border-r border-slate-200 bg-white p-3 transition-transform dark:border-slate-800 dark:bg-slate-900 lg:static lg:translate-x-0", open ? "translate-x-0" : "-translate-x-full")}>
        <div className="mb-4 px-2 py-2 text-lg font-bold">FB Video Automation</div>
        <nav aria-label="Main navigation" className="space-y-1">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? path === "/" : path.startsWith(href);
            return (
              <Link key={href} href={href} onClick={() => setOpen(false)} aria-current={active ? "page" : undefined}
                className={cn("flex items-center gap-3 rounded-md px-3 py-2 text-sm", active ? "bg-blue-600 text-white" : "hover:bg-slate-100 dark:hover:bg-slate-800")}>
                <Icon size={16} />{label}
              </Link>
            );
          })}
        </nav>
      </aside>
      {open && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setOpen(false)} aria-hidden />}
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-2 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
          <button className="rounded p-2 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden" aria-label="Open navigation" onClick={() => setOpen(true)}><Menu size={20} /></button>
          <span className="rounded bg-amber-100 px-2 py-1 text-xs font-medium text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">SAMPLE DATA — not real Facebook data. Publishing disabled.</span>
          <button className="rounded p-2 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Toggle dark mode" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
            <Sun size={18} className="hidden dark:block" /><Moon size={18} className="dark:hidden" />
          </button>
        </header>
        <main className="p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
