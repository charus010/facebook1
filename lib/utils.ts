import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Deterministic formatting (UTC) so server and client render identically. */
export function fmt(iso: string | null): string {
  if (!iso) return "—";
  return iso.replace("T", " ").slice(0, 16) + " UTC";
}
