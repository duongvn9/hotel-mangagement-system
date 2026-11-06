import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Badge as BadgePrimitive } from '../ui/badge'

const toneStyles = {
  success: 'bg-success/15 text-success',
  danger: 'bg-destructive/15 text-destructive',
  info: 'bg-info/15 text-info',
  warning: 'bg-warning/15 text-warning',
  neutral: 'bg-muted text-muted-foreground',
} as const

export type BadgeTone = keyof typeof toneStyles

export interface BadgeProps {
  tone?: BadgeTone
  children: ReactNode
  className?: string
}

/**
 * Chip trạng thái dạng atom: luôn có chữ + chấm màu trang trí, không convey trạng thái chỉ bằng màu.
 * Đối với mã trạng thái nghiệp vụ (status code), ưu tiên dùng `StatusBadge`.
 */
export function Badge({ tone = 'neutral', children, className }: BadgeProps) {
  return (
    <BadgePrimitive
      variant="outline"
      className={cn(
        'h-6 rounded-full px-2.5 text-xs font-semibold whitespace-nowrap gap-1.5 border-transparent shadow-none',
        toneStyles[tone],
        className,
      )}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {children}
    </BadgePrimitive>
  )
}
