import * as React from "react";
import { cn } from "@/shared/utils/cn";

export function Dialog({ open, onOpenChange, children }: { open?: boolean; onOpenChange?: (open: boolean) => void; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="fixed inset-0" onClick={() => onOpenChange?.(false)} />
      {children}
    </div>
  );
}

export function DialogContent({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn(
      "relative z-[101] w-full max-w-lg bg-white p-6 shadow-2xl rounded-2xl border border-slate-200 animate-in zoom-in-95 duration-200", 
      className
    )}>
      {children}
    </div>
  );
}

export function DialogHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col space-y-2 text-center sm:text-left mb-4", className)}>
      {children}
    </div>
  );
}

export function DialogTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h2 className={cn("text-xl font-bold leading-none tracking-tight text-slate-900", className)}>
      {children}
    </h2>
  );
}

export function DialogFooter({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-3 mt-6 pt-4 border-t border-slate-100", className)}>
      {children}
    </div>
  );
}
