"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from "lucide-react";

export interface ToastMessage {
  id: string;
  type: "success" | "error" | "warning" | "info";
  title?: string;
  message: string;
  duration?: number;
}

interface ToastContextType {
  toasts: ToastMessage[];
  addToast: (type: "success" | "error" | "warning" | "info", message: string, title?: string, duration?: number) => void;
  removeToast: (id: string) => void;
}

let toastIdCounter = 0;

function generateToastId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  toastIdCounter = (toastIdCounter + 1) % Number.MAX_SAFE_INTEGER;
  return `toast-${Date.now()}-${toastIdCounter}`;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback(
    (type: "success" | "error" | "warning" | "info", message: string, title?: string, duration?: number) => {
      const id = generateToastId();
      setToasts((prev) => [...prev, { id, type, message, title, duration }]);
    },
    []
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastNotificationContainer toasts={toasts} onDismiss={removeToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    console.warn("[useToast] ToastProvider is missing in the component tree. Notifications may not be displayed.");
    return {
      toasts: [],
      addToast: (type: string, msg: string) => console.warn(`[Toast ${type}]`, msg),
      removeToast: () => {},
    };
  }
  return context;
}

export function ToastNotificationContainer({
  toasts,
  onDismiss,
}: {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}) {
  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={() => onDismiss(t.id)} />
      ))}
    </div>
  );
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: ToastMessage;
  onDismiss: () => void;
}) {
  const onDismissRef = React.useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    const duration = toast.duration ?? 4500;
    const timer = setTimeout(() => {
      onDismissRef.current();
    }, duration);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration]);

  const styleMap = {
    success: {
      border: "border-emerald-500/30",
      bg: "bg-emerald-500/10 dark:bg-emerald-950/40",
      text: "text-emerald-700 dark:text-emerald-300",
      icon: <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />,
    },
    error: {
      border: "border-destructive/30",
      bg: "bg-destructive/10 dark:bg-destructive/20",
      text: "text-destructive",
      icon: <AlertCircle className="h-4 w-4 text-destructive shrink-0" />,
    },
    warning: {
      border: "border-amber-500/30",
      bg: "bg-amber-500/10 dark:bg-amber-950/40",
      text: "text-amber-700 dark:text-amber-300",
      icon: <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />,
    },
    info: {
      border: "border-blue-500/30",
      bg: "bg-blue-500/10 dark:bg-blue-950/40",
      text: "text-blue-700 dark:text-blue-300",
      icon: <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />,
    },
  };

  const style = styleMap[toast.type] || styleMap.info;

  return (
    <div
      className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border ${style.border} ${style.bg} backdrop-blur-md shadow-lg transition-all animate-in slide-in-from-bottom-5 duration-250`}
    >
      <div className="pt-0.5">{style.icon}</div>
      <div className="flex-1 min-w-0">
        {toast.title && (
          <h4 className={`text-xs font-bold ${style.text} tracking-tight`}>
            {toast.title}
          </h4>
        )}
        <p className={`text-xs ${style.text} leading-relaxed`}>
          {toast.message}
        </p>
      </div>
      <button
        onClick={onDismiss}
        className="text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded-md hover:bg-muted/50"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
