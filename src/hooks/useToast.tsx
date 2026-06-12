"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { CheckCircleIcon, AlertCircleIcon, XIcon } from "@/components/icons";

type ToastVariant = "success" | "error";

interface Toast {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

let counter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (message: string, variant: ToastVariant) => {
      const id = ++counter;
      setToasts((prev) => [...prev, { id, message, variant }]);
      setTimeout(() => remove(id), 7000);
    },
    [remove],
  );

  const success = useCallback((m: string) => push(m, "success"), [push]);
  const error = useCallback((m: string) => push(m, "error"), [push]);

  return (
    <ToastContext.Provider value={{ success, error }}>
      {children}
      <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2.5 w-[calc(100%-2.5rem)] max-w-sm">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className="animate-slide-in-right flex items-start gap-3 rounded-xl border border-border bg-surface px-4 py-3.5 shadow-[var(--shadow-lg)]"
          >
            <span className={t.variant === "success" ? "text-success" : "text-danger"}>
              {t.variant === "success" ? (
                <CheckCircleIcon className="size-5" />
              ) : (
                <AlertCircleIcon className="size-5" />
              )}
            </span>
            <p className="flex-1 text-sm leading-snug text-text">{t.message}</p>
            <button
              onClick={() => remove(t.id)}
              className="text-text-faint hover:text-text -mr-1 -mt-0.5 p-0.5"
              aria-label="Fechar"
            >
              <XIcon className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast deve ser usado dentro de ToastProvider");
  return ctx;
}
