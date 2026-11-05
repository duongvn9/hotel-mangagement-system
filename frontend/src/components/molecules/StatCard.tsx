import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  trend,
}: {
  label: string
  value: ReactNode
  hint?: string
  icon?: LucideIcon
  trend?: string
}) {
  return (
    <div className="card-soft p-5">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        {label}
        {Icon && (
          <span className="grid size-8 place-items-center rounded-full bg-surface text-primary">
            <Icon className="size-4" />
          </span>
        )}
      </div>
      <div className="mt-3 text-2xl font-semibold tracking-tight">{value}</div>
      {(hint || trend) && (
        <div className="mt-1 text-xs text-muted-foreground">
          {trend && <span className="mr-1 font-medium text-success">{trend}</span>}
          {hint}
        </div>
      )}
    </div>
  )
}
