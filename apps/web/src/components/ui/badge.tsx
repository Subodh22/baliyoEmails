import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-[rgba(255,255,255,0.06)] text-[#EDEDED]",
        active: "bg-emerald-500/10 text-emerald-400",
        paused: "bg-amber-500/10 text-amber-400",
        draft: "bg-[rgba(255,255,255,0.05)] text-[#666]",
        error: "bg-red-500/10 text-red-400",
        replied: "bg-blue-500/10 text-blue-400",
        finished: "bg-[rgba(255,255,255,0.05)] text-[#555]",
        accent: "bg-[rgba(212,146,74,0.15)] text-[#D4924A]",
        pending: "bg-[rgba(255,255,255,0.04)] text-[#777]",
        bounced: "bg-red-500/10 text-red-400",
        unsubscribed: "bg-[rgba(255,255,255,0.05)] text-[#555]",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
