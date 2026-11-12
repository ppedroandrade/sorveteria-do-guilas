import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap [&_svg]:size-3",
  {
    variants: {
      variant: {
        default: "bg-primary-soft text-primary",
        caramel: "bg-caramel-soft text-caramel-foreground",
        muted: "bg-muted text-muted-foreground",
        outline: "border border-border text-foreground",
        destructive: "bg-destructive-soft text-destructive",
        info: "bg-sky-100 text-sky-800",
        violet: "bg-violet-100 text-violet-800",
        success: "bg-emerald-100 text-emerald-800",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

export function Badge({ className, variant, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
