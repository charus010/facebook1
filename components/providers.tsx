"use client";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import type { ReactNode } from "react";
import { StoreProvider } from "@/lib/store";
import { Shell } from "./shell";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <StoreProvider>
        <Shell>{children}</Shell>
        <Toaster richColors position="top-right" />
      </StoreProvider>
    </ThemeProvider>
  );
}
