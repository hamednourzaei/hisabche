// packages/ui/src/components/ui/toast-provider.tsx
"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { Toast, ToastContainer, type ToastVariant } from "./toast";

// ─── Types ──────────────────────────────────────────────────
interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
}

interface ToastContextType {
  toast: (props: { title: string; description?: string; variant?: ToastVariant; duration?: number }) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  warning: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
}

// ─── Context ────────────────────────────────────────────────
const ToastContext = createContext<ToastContextType | null>(null);

let toastId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((props: { title: string; description?: string; variant?: ToastVariant; duration?: number }) => {
    const id = `toast-${++toastId}`;
    const item: ToastItem = { id, title: props.title };
    if (props.description !== undefined) item.description = props.description;
    if (props.variant !== undefined) item.variant = props.variant;
    if (props.duration !== undefined) item.duration = props.duration;
    setToasts((prev) => [...prev, item]);
  }, []);

  const toast = useCallback((props: { title: string; description?: string; variant?: ToastVariant; duration?: number }) => {
    addToast(props);
  }, [addToast]);

  const success = useCallback((title: string, description?: string) => {
    const props: { title: string; description?: string; variant: ToastVariant } = { title, variant: "success" };
    if (description !== undefined) props.description = description;
    addToast(props);
  }, [addToast]);

  const error = useCallback((title: string, description?: string) => {
    const props: { title: string; description?: string; variant: ToastVariant; duration: number } = { title, variant: "error", duration: 8000 };
    if (description !== undefined) props.description = description;
    addToast(props);
  }, [addToast]);

  const warning = useCallback((title: string, description?: string) => {
    const props: { title: string; description?: string; variant: ToastVariant; duration: number } = { title, variant: "warning", duration: 6000 };
    if (description !== undefined) props.description = description;
    addToast(props);
  }, [addToast]);

  const info = useCallback((title: string, description?: string) => {
    const props: { title: string; description?: string; variant: ToastVariant } = { title, variant: "info" };
    if (description !== undefined) props.description = description;
    addToast(props);
  }, [addToast]);

  return (
    <ToastContext.Provider value={{ toast, success, error, warning, info }}>
      {children}
      <ToastContainer position="bottom-right">
        {toasts.map((t) => (
          <Toast
            key={t.id}
            id={t.id}
            title={t.title}
            description={t.description}
            variant={t.variant}
            duration={t.duration}
            onDismiss={removeToast}
          />
        ))}
      </ToastContainer>
    </ToastContext.Provider>
  );
}

// ─── Hook ───────────────────────────────────────────────────
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}