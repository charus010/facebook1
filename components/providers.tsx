"use client";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import type { ReactNode } from "react";
import { StoreProvider, useStore } from "@/lib/store";
import { Shell } from "./shell";
import { Login } from "./login";
import { PageSkeleton } from "./ui";

function Gate({ children }: { children: ReactNode }) {
  const { live, auth } = useStore();
  if (live && auth === "checking") return <div className="p-6"><PageSkeleton /></div>;
  if (live && auth !== "authed") return <Login />;
  return <Shell>{children}</Shell>;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <StoreProvider>
        <Gate>{children}</Gate>
        <Toaster richColors position="top-right" />
      </StoreProvider>
    </ThemeProvider>
  );
}
