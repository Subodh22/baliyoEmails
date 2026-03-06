import * as React from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-md border border-[rgba(255,255,255,0.07)] bg-[#111] px-3 py-2 text-sm text-[#EDEDED] placeholder:text-[#444] transition-colors resize-none",
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
Textarea.displayName = "Textarea";

export { Textarea };
