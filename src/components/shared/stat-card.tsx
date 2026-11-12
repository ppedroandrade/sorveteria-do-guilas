import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "default",
  href,
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: "default" | "primary" | "caramel" | "alert";
  href?: string;
  className?: string;
}) {
  const toneIcon = {
    default: "bg-muted text-foreground/70",
    primary: "bg-primary-soft text-primary",
    caramel: "bg-caramel-soft text-caramel-foreground",
    alert: "bg-destructive-soft text-destructive",
  }[tone];
  const body = (
    <div
      className={cn(
        "group flex h-full flex-col justify-between gap-3 rounded-xl border bg-card p-4 shadow-soft transition-all sm:p-5",
        href && "hover:-translate-y-0.5 hover:shadow-lift",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase leading-snug tracking-wide text-muted-foreground sm:text-xs">{label}</p>
        {icon && <span className={cn("rounded-lg p-2 [&_svg]:size-4", toneIcon)}>{icon}</span>}
      </div>
      <div>
        <p className="font-display text-xl font-semibold leading-tight tabular sm:text-2xl xl:text-[1.7rem]">{value}</p>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </div>
    </div>
  );
  return href ? (
    <Link href={href} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl">
      {body}
    </Link>
  ) : (
    body
  );
}
