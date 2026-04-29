"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "outline" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

const variantClasses: Record<string, string> = {
  primary:
    "bg-primary text-white hover:bg-primary/90 shadow-lg shadow-primary/20",
  secondary:
    "bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-600/20",
  ghost: "text-gray-600 hover:text-primary hover:bg-gray-100",
  outline:
    "border border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300",
  danger: "bg-red-600 text-white hover:bg-red-700",
};

const sizeClasses: Record<string, string> = {
  sm: "text-sm px-4 py-2 rounded-lg",
  md: "text-sm px-6 py-3 rounded-xl",
  lg: "text-base px-8 py-4 rounded-full",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      loading = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed",
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <svg
            className="animate-spin h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";

export { Button };
