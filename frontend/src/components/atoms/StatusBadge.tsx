import { label } from '@/lib/format'
import { cn } from '@/lib/utils'

const tones = {
  success: 'text-success',
  warning: 'text-warning',
  info: 'text-info',
  danger: 'text-danger',
  neutral: 'text-muted-foreground',
  brand: 'text-primary',
} as const

type Tone = keyof typeof tones

const statusTone: Record<string, Tone> = {
  CONFIRMED: 'success',
  CHECKED_IN: 'info',
  CHECKED_OUT: 'neutral',
  CANCELLED: 'danger',
  EXPIRED: 'neutral',
  PENDING_DEPOSIT: 'warning',
  ROOM_HELD: 'warning',
  AVAILABLE: 'success',
  OCCUPIED: 'info',
  CLEANING: 'warning',
  MAINTENANCE: 'danger',
  SUCCESS: 'success',
  PENDING: 'warning',
  FAILED: 'danger',
  IN_PROGRESS: 'info',
  DONE: 'success',
  OPEN: 'warning',
  REPORTED: 'warning',
  RESOLVED: 'success',
  GOOD: 'success',
  NEEDS_REPAIR: 'warning',
  BROKEN: 'danger',
  HIGH: 'danger',
  MEDIUM: 'warning',
  LOW: 'neutral',
  ACTIVE: 'success',
  INACTIVE: 'neutral',
  WALK_IN: 'brand',
  ONLINE: 'neutral',
}

/** Trạng thái dạng chấm màu + chữ (luôn có chữ, không chỉ dùng màu). Trạng thái lạ → tông trung tính. */
export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const tone = tones[statusTone[status] ?? 'neutral']
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 text-[13px] font-medium tracking-tight whitespace-nowrap',
        tone,
        className,
      )}
    >
      <span className="size-1.5 shrink-0 rounded-full bg-current" />
      {label(status)}
    </span>
  )
}
