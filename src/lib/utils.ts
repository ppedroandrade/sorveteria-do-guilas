import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function onlyDigits(value: string | null | undefined): string {
  return (value ?? "").replace(/\D+/g, "");
}

export function formatOrderNumber(n: number): string {
  return `#${String(n).padStart(4, "0")}`;
}

export function formatPhone(value: string | null | undefined): string {
  const d = onlyDigits(value);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return value ?? "";
}

/** Converte "" e espaços em null — útil para campos opcionais vindos de formulários. */
export function emptyToNull(value: string | null | undefined): string | null {
  const v = (value ?? "").trim();
  return v.length ? v : null;
}
