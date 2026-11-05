import { Inbox, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

export function EmptyState({
  title,
  body,
  action,
  icon: Icon = Inbox,
}: {
  title: string
  body?: string
  action?: ReactNode
  icon?: LucideIcon
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-surface/50 px-6 py-14 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-card text-primary shadow-sm">
        <Icon className="size-5" />
      </span>
      <h3 className="mt-4 font-semibold">{title}</h3>
      {body && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
