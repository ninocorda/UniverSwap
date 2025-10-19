"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

export type Toast = {
  id: string;
  kind?: "success" | "error" | "info";
  title?: string;
  message: string;
  linkHref?: string;
  linkLabel?: string;
  timeoutMs?: number;
};

type ToastCtx = {
  addToast: (t: Omit<Toast, "id">) => void;
};

const Ctx = createContext<ToastCtx | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);

  const addToast = useCallback((t: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).slice(2);
    const toast: Toast = { id, kind: "info", timeoutMs: 6000, ...t };
    setItems((arr) => [...arr, toast]);
    const to = setTimeout(() => {
      setItems((arr) => arr.filter((x) => x.id !== id));
    }, toast.timeoutMs);
    return () => clearTimeout(to);
  }, []);

  const value = useMemo(() => ({ addToast }), [addToast]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex w-full justify-center">
        <div className="flex w-full max-w-md flex-col gap-2 px-4">
          {items.map((t) => (
            <div key={t.id} className={`pointer-events-auto rounded border p-3 shadow backdrop-blur-sm ${
              t.kind === "success"
                ? "border-green-500/30 bg-green-500/10 text-green-100"
                : t.kind === "error"
                ? "border-red-500/30 bg-red-500/10 text-red-100"
                : "border-white/20 bg-white/10 text-neutral-100"
            }`}>
              {t.title && <div className="text-sm font-semibold">{t.title}</div>}
              <div className="text-sm break-words">
                {(() => {
                  const msg = t.message || "";
                  const isHash = /^0x[0-9a-fA-F]{64}$/.test(msg);
                  if (isHash) {
                    return `${msg.slice(0, 10)}…${msg.slice(-10)}`;
                  }
                  if (msg.length > 120) return msg.slice(0, 117) + "…";
                  return msg;
                })()}
              </div>
              {t.linkHref && (
                <a
                  href={t.linkHref}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-block text-xs underline opacity-90 hover:opacity-100"
                >
                  {t.linkLabel || "View on explorer"}
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
