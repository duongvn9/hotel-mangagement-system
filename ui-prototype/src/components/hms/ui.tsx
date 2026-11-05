import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Inbox, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { label } from "@/lib/format";

const tones: Record<string, string> = {
  success: "text-success",
  warning: "text-warning",
  info: "text-info",
  danger: "text-danger",
  neutral: "text-muted-foreground",
  brand: "text-primary",
};
const statusTone: Record<string, keyof typeof tones> = {
  CONFIRMED: "success", CHECKED_IN: "info", CHECKED_OUT: "neutral", CANCELLED: "danger", EXPIRED: "neutral", PENDING_DEPOSIT: "warning", ROOM_HELD: "warning",
  AVAILABLE: "success", OCCUPIED: "info", CLEANING: "warning", MAINTENANCE: "danger",
  SUCCESS: "success", PENDING: "warning", FAILED: "danger", IN_PROGRESS: "info", DONE: "success", OPEN: "warning",
  REPORTED: "warning", RESOLVED: "success", GOOD: "success", NEEDS_REPAIR: "warning", BROKEN: "danger",
  HIGH: "danger", MEDIUM: "warning", LOW: "neutral", ACTIVE: "success", INACTIVE: "neutral", WALK_IN: "brand", ONLINE: "neutral",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const t = tones[statusTone[status] ?? "neutral"];
  return (
    <span className={cn("inline-flex items-center gap-2 whitespace-nowrap text-[13px] font-medium tracking-tight", t, className)}>
      <span className="size-1.5 shrink-0 rounded-full bg-current" />
      {label(status)}
    </span>
  );
}

export function Proposed() {
  return <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-info">Đề xuất UX</span>;
}

export function PageHeader({ title, subtitle, actions, eyebrow }: { title: string; subtitle?: string; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <div className="mb-1 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{eyebrow}</div>}
        <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({ label: l, value, hint, icon: Icon, trend }: { label: string; value: ReactNode; hint?: string; icon?: LucideIcon; trend?: string }) {
  return (
    <div className="card-soft p-5">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        {l}
        {Icon && <span className="grid size-8 place-items-center rounded-full bg-surface text-primary"><Icon className="size-4" /></span>}
      </div>
      <div className="mt-3 text-2xl font-semibold tracking-tight">{value}</div>
      {(hint || trend) && (
        <div className="mt-1 text-xs text-muted-foreground">
          {trend && <span className="mr-1 font-medium text-success">{trend}</span>}
          {hint}
        </div>
      )}
    </div>
  );
}

export function Panel({ title, action, children, className }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("card-soft", className)}>
      {title && (
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="text-sm font-semibold">{title}</h2>
          {action}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function EmptyState({ title, body, action, icon: Icon = Inbox }: { title: string; body?: string; action?: ReactNode; icon?: LucideIcon }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-surface/50 px-6 py-14 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-card text-primary shadow-sm"><Icon className="size-5" /></span>
      <h3 className="mt-4 font-semibold">{title}</h3>
      {body && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function KV({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 text-sm">
      <span className="text-muted-foreground">{k}</span>
      <span className="text-right font-medium">{v}</span>
    </div>
  );
}

export function Stars({ value, onChange }: { value: number; onChange?: (n: number) => void }) {
  return <div className="flex gap-1">{[1, 2, 3, 4, 5].map((n) => <button type="button" key={n} disabled={!onChange} onClick={() => onChange?.(n)} aria-label={`${n} stars`}><Star className={cn("size-5", n <= value ? "fill-primary text-primary" : "text-border")} /></button>)}</div>;
}

