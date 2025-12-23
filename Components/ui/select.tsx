import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";

interface SelectContextValue {
  value: string;
  onValueChange: (value: string) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
}

const SelectContext = React.createContext<SelectContextValue | undefined>(undefined);

interface SelectProps {
  value?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
}

export function Select({ value = "", onValueChange = () => {}, children }: SelectProps) {
  const [open, setOpen] = useState(false);

  return (
    <SelectContext.Provider value={{ value, onValueChange, open, setOpen }}>
      <div className="relative">{children}</div>
    </SelectContext.Provider>
  );
}

interface SelectTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

export const SelectTrigger = React.forwardRef<HTMLButtonElement, SelectTriggerProps>(
  ({ className = "", children, ...props }, ref) => {
    const context = React.useContext(SelectContext);
    if (!context) throw new Error("SelectTrigger must be used within Select");

    return (
      <button
        type="button"
        ref={ref}
        onClick={() => context.setOpen(!context.open)}
        className={`flex h-10 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
        {...props}
      >
        {children}
        <ChevronDown className="h-4 w-4 opacity-50" />
      </button>
    );
  }
);
SelectTrigger.displayName = "SelectTrigger";

interface SelectValueProps {
  placeholder?: string;
}

export function SelectValue({ placeholder }: SelectValueProps) {
  const context = React.useContext(SelectContext);
  if (!context) throw new Error("SelectValue must be used within Select");

  return <span>{context.value || placeholder}</span>;
}

interface SelectContentProps {
  children: React.ReactNode;
  className?: string;
}

export function SelectContent({ children, className = "" }: SelectContentProps) {
  const context = React.useContext(SelectContext);
  const contentRef = useRef<HTMLDivElement>(null);

  if (!context) throw new Error("SelectContent must be used within Select");

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (contentRef.current && !contentRef.current.contains(event.target as Node)) {
        context.setOpen(false);
      }
    }

    if (context.open) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [context.open, context]);

  if (!context.open) return null;

  return (
    <div
      ref={contentRef}
      className={`absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-slate-200 bg-white py-1 text-base shadow-lg focus:outline-none sm:text-sm ${className}`}
    >
      {children}
    </div>
  );
}

interface SelectItemProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

export function SelectItem({ value, children, className = "" }: SelectItemProps) {
  const context = React.useContext(SelectContext);
  if (!context) throw new Error("SelectItem must be used within Select");

  const isSelected = context.value === value;

  return (
    <div
      onClick={() => {
        context.onValueChange(value);
        context.setOpen(false);
      }}
      className={`relative flex cursor-pointer select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none hover:bg-slate-100 focus:bg-slate-100 ${className}`}
    >
      {isSelected && (
        <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
          <Check className="h-4 w-4" />
        </span>
      )}
      {children}
    </div>
  );
}

export default Select;
