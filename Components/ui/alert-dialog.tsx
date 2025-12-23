import React, { useState, createContext, useContext } from "react";

interface AlertDialogContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const AlertDialogContext = createContext<AlertDialogContextValue | undefined>(undefined);

interface AlertDialogProps {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function AlertDialog({ children, open: controlledOpen, onOpenChange }: AlertDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  return (
    <AlertDialogContext.Provider value={{ open, setOpen }}>
      {children}
    </AlertDialogContext.Provider>
  );
}

interface AlertDialogTriggerProps {
  children: React.ReactNode;
  asChild?: boolean;
}

export function AlertDialogTrigger({ children, asChild }: AlertDialogTriggerProps) {
  const context = useContext(AlertDialogContext);
  if (!context) throw new Error("AlertDialogTrigger must be used within AlertDialog");

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<{ onClick?: () => void }>, {
      onClick: () => context.setOpen(true),
    });
  }

  return (
    <button onClick={() => context.setOpen(true)}>
      {children}
    </button>
  );
}

interface AlertDialogContentProps {
  children: React.ReactNode;
  className?: string;
}

export function AlertDialogContent({ children, className = "" }: AlertDialogContentProps) {
  const context = useContext(AlertDialogContext);
  if (!context) throw new Error("AlertDialogContent must be used within AlertDialog");

  if (!context.open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50"
        onClick={() => context.setOpen(false)}
      />
      {/* Content */}
      <div
        className={`relative z-50 grid w-full max-w-lg gap-4 border border-slate-200 bg-white p-6 shadow-lg sm:rounded-lg ${className}`}
      >
        {children}
      </div>
    </div>
  );
}

interface AlertDialogHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export function AlertDialogHeader({ children, className = "" }: AlertDialogHeaderProps) {
  return (
    <div className={`flex flex-col space-y-2 text-center sm:text-left ${className}`}>
      {children}
    </div>
  );
}

interface AlertDialogTitleProps {
  children: React.ReactNode;
  className?: string;
}

export function AlertDialogTitle({ children, className = "" }: AlertDialogTitleProps) {
  return <h2 className={`text-lg font-semibold ${className}`}>{children}</h2>;
}

interface AlertDialogDescriptionProps {
  children: React.ReactNode;
  className?: string;
}

export function AlertDialogDescription({ children, className = "" }: AlertDialogDescriptionProps) {
  return <p className={`text-sm text-slate-500 ${className}`}>{children}</p>;
}

interface AlertDialogFooterProps {
  children: React.ReactNode;
  className?: string;
}

export function AlertDialogFooter({ children, className = "" }: AlertDialogFooterProps) {
  return (
    <div className={`flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 ${className}`}>
      {children}
    </div>
  );
}

interface AlertDialogActionProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

export function AlertDialogAction({ children, className = "", onClick, ...props }: AlertDialogActionProps) {
  const context = useContext(AlertDialogContext);
  if (!context) throw new Error("AlertDialogAction must be used within AlertDialog");

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(e);
    context.setOpen(false);
  };

  return (
    <button
      className={`inline-flex h-10 items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${className}`}
      onClick={handleClick}
      {...props}
    >
      {children}
    </button>
  );
}

interface AlertDialogCancelProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

export function AlertDialogCancel({ children, className = "", onClick, ...props }: AlertDialogCancelProps) {
  const context = useContext(AlertDialogContext);
  if (!context) throw new Error("AlertDialogCancel must be used within AlertDialog");

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(e);
    context.setOpen(false);
  };

  return (
    <button
      className={`mt-2 inline-flex h-10 items-center justify-center rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold transition-colors hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 sm:mt-0 ${className}`}
      onClick={handleClick}
      {...props}
    >
      {children}
    </button>
  );
}

export default AlertDialog;
