import type { ReactNode } from 'react'

export function KeyValue({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 text-sm">
      <span className="text-muted-foreground">{k}</span>
      <span className="text-right font-medium">{v}</span>
    </div>
  )
}
