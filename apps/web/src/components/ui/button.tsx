"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#D4924A] disabled:pointer-events-none disabled:opacity-40 gap-2",
  {
    variants: {
      variant: {
        default:
          "bg-[#D4924A] text-[#0A0A0A] hover:bg-[#C4823A] font-medium",
        ghost:
          "text-[#EDEDED] hover:bg-[rgba(255,255,255,0.05)] hover:text-[#EDEDED]",
        outline:
          "border border-[rgba(255,255,255,0.08)] text-[#EDEDED] hover:bg-[rgba(255,255,255,0.04)]",
        destructive:
          "bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20",
        link: "text-[#D4924A] underline-offset-4 hover:underline p-0 h-auto",
        muted:
          "bg-[rgba(255,255,255,0.04)] text-[#999] hover:bg-[rgba(255,255,255,0.07)] hover:text-[#EDEDED]",
      },
      size: {
        default: "h-8 px-3 rounded-md",
        sm: "h-7 px-2.5 text-xs rounded",
        lg: "h-10 px-5 rounded-md",
        icon: "h-8 w-8 rounded-md",
        "icon-sm": "h-7 w-7 rounded",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : null}
        {children}
      </Comp>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
