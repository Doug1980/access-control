"use client";

import { useEffect, useState } from "react";
import { TrashIcon } from "@/components/icons";

interface Props {
  open: boolean;
  userName: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export function ConfirmDialog({ open, userName, onClose, onConfirm }: Props) {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function handleConfirm() {
    setLoading(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="animate-scale-in w-full max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-[var(--shadow-lg)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="grid size-11 place-items-center rounded-full bg-danger-soft text-danger">
          <TrashIcon className="size-5" />
        </div>
        <h2 className="mt-4 text-base font-semibold text-text">Excluir usuário</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-text-muted">
          Tem certeza que deseja excluir{" "}
          <span className="font-medium text-text">{userName}</span>? Essa ação não
          pode ser desfeita.
        </p>
        <div className="mt-6 flex justify-end gap-2.5">
          <button onClick={onClose} className="btn-ghost">
            Cancelar
          </button>
          <button onClick={handleConfirm} disabled={loading} className="btn-danger">
            {loading ? "Excluindo…" : "Excluir"}
          </button>
        </div>
      </div>
    </div>
  );
}
