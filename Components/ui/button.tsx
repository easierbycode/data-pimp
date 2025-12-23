import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  asChild?: boolean;
}

const buttonVariants = {
  default: "bg-slate-900 text-white hover:bg-slate-800",
  destructive: "bg-red-600 text-white hover:bg-red-700",
  outline: "border border-slate-200 bg-white hover:bg-slate-100 hover:text-slate-900",
  secondary: "bg-slate-100 text-slate-900 hover:bg-slate-200",
  ghost: "hover:bg-slate-100 hover:text-slate-900",
  link: "text-slate-900 underline-offset-4 hover:underline",
};

const buttonSizes = {
  default: "h-10 px-4 py-2",
  sm: "h-9 rounded-md px-3",
  lg: "h-11 rounded-md px-8",
  icon: "h-10 w-10",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = "", variant = "default", size = "default", children, ...props }, ref) => {
    const baseClasses =
      "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";

    const variantClasses = buttonVariants[variant] || buttonVariants.default;
    const sizeClasses = buttonSizes[size] || buttonSizes.default;

    return (
      <button
        className={`${baseClasses} ${variantClasses} ${sizeClasses} ${className}`}
        ref={ref}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";

export default Button;
