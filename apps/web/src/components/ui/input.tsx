import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-8 w-full rounded-md border border-[rgba(255,255,255,0.07)] bg-[#111] px-3 py-1.5 text-sm text-[#EDEDED] placeholder:text-[#444] transition-colors",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#D4924A] focus-visible:border-[#D4924A]",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
