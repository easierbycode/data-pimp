import React from "react";

export interface SwitchProps {
  id?: string;
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

export const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ checked = false, onCheckedChange, disabled = false, className = "", ...props }, ref) => {
    return (
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        ref={ref}
        onClick={() => onCheckedChange?.(!checked)}
        className={`
          peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent
          transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950
          focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-50
          ${checked ? "bg-slate-900" : "bg-slate-200"}
          ${className}
        `}
        {...props}
      >
        <span
          className={`
            pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform
            ${checked ? "translate-x-5" : "translate-x-0"}
          `}
        />
      </button>
    );
  }
);

Switch.displayName = "Switch";

export default Switch;
