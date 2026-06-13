import React from "react";

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline";
}

const badgeVariants = {
  default: "border-transparent bg-slate-900 text-slate-50 hover:bg-slate-900/80",
  secondary: "border-transparent bg-slate-100 text-slate-900 hover:bg-slate-100/80",
  destructive: "border-transparent bg-red-500 text-slate-50 hover:bg-red-500/80",
  outline: "text-slate-950 border-slate-200",
};

export const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className = "", variant = "default", ...props }, ref) => {
    const variantClasses = badgeVariants[variant] || badgeVariants.default;

    return (
      <div
        ref={ref}
        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold backdrop-blur-[2px] shadow-[inset_0_1px_0_rgba(255,255,255,0.6),inset_0_0_0_1px_rgba(255,255,255,0.22),inset_0_0_0_999px_rgba(255,255,255,0.15),0_1px_1px_rgba(0,0,0,0.3)] [text-shadow:0_1px_1px_rgba(0,0,0,0.35),0_0_2px_rgba(255,255,255,0.5)] transition-colors focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2 ${variantClasses} ${className}`}
        {...props}
      />
    );
  }
);

Badge.displayName = "Badge";

export default Badge;
