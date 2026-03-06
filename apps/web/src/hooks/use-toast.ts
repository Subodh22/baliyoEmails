"use client";

import * as React from "react";

type ToastVariant = "default" | "destructive";

interface ToastData {
  id: string;
  title?: string;
  description?: string;
  variant?: ToastVariant;
  open: boolean;
}

const toastState: { toasts: ToastData[]; listeners: Set<() => void> } = {
  toasts: [],
  listeners: new Set(),
};

function notify() {
  toastState.listeners.forEach((l) => l());
}

export function toast({
  title,
  description,
  variant = "default",
}: {
  title?: string;
  description?: string;
  variant?: ToastVariant;
}) {
  const id = Math.random().toString(36).slice(2);
  toastState.toasts = [...toastState.toasts, { id, title, description, variant, open: true }];
  notify();

  setTimeout(() => {
    toastState.toasts = toastState.toasts.map((t) =>
      t.id === id ? { ...t, open: false } : t
    );
    notify();

    setTimeout(() => {
      toastState.toasts = toastState.toasts.filter((t) => t.id !== id);
      notify();
    }, 300);
  }, 4000);
}

export function useToast() {
  const [toasts, setToasts] = React.useState<ToastData[]>(toastState.toasts);

  React.useEffect(() => {
    const listener = () => setToasts([...toastState.toasts]);
    toastState.listeners.add(listener);
    return () => { toastState.listeners.delete(listener); };
  }, []);

  return { toasts, toast };
}
