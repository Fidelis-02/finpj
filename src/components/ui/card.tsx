"use client";

import { type HTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "elevated" | "glass" | "outlined";
  padding?: "none" | "sm" | "md" | "lg";
  hover?: boolean;
}

const variantClasses: Record<string, string> = {
  default: "bg-white border border-slate-200/80 shadow-[0_8px_30px_rgba(15,35,65,0.04)]",
  elevated: "bg-white border border-slate-200/80 shadow-[0_16px_40px_rgba(15,35,65,0.08)]",
  glass:
    "bg-white/5 backdrop-blur-xl border border-white/10 text-white",
  outlined: "bg-transparent border border-gray-200",
};

const paddingClasses: Record<string, string> = {
  none: "",
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
};

const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      className,
      variant = "default",
      padding = "md",
      hover = false,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-2xl transition-all duration-200",
          variantClasses[variant],
          paddingClasses[padding],
          hover && "hover:shadow-[0_16px_40px_rgba(15,35,65,0.1)] hover:-translate-y-0.5 cursor-pointer",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = "Card";

export { Card };
