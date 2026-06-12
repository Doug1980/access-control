import type { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: number | string;
  icon: ReactNode;
  tone?: "accent" | "success" | "warning";
  loading?: boolean;
}

const toneStyles: Record<string, string> = {
  accent: "bg-accent-soft text-accent",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
};

export function StatCard({
  label,
  value,
  icon,
  tone = "accent",
  loading = false,
}: StatCardProps) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-[var(--shadow)]">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-text-muted">{label}</span>
        <span className={`grid size-9 place-items-center rounded-lg ${toneStyles[tone]}`}>
          {icon}
        </span>
      </div>
      {loading ? (
        <div className="skeleton mt-3 h-8 w-16 rounded-md" />
      ) : (
        <p className="mt-2 text-3xl font-semibold tracking-tight text-text tabular-nums">
          {value}
        </p>
      )}
    </div>
  );
}
