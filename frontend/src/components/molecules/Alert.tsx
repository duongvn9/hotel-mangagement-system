import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Alert as AlertPrimitive, AlertDescription, AlertTitle } from '../ui/alert'

const toneStyles = {
  success: 'border-success/30 bg-success/10 text-success [&>svg]:text-success',
  danger: 'border-destructive/30 bg-destructive/10 text-destructive [&>svg]:text-destructive',
  info: 'border-info/30 bg-info/10 text-info [&>svg]:text-info',
  warning: 'border-warning/30 bg-warning/10 text-warning [&>svg]:text-warning',
} as const

export type AlertTone = keyof typeof toneStyles

export interface AlertProps {
  tone: AlertTone
  children: ReactNode
  title?: string
  className?: string
}

/**
 * Hộp cảnh báo / thông báo theo thiết kế prototype.
 * tone="danger" gán role="alert", các tone khác gán role="status".
 */
export function Alert({ tone, children, title, className }: AlertProps) {
  return (
    <AlertPrimitive
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn(toneStyles[tone], className)}
    >
      {title && <AlertTitle>{title}</AlertTitle>}
      <AlertDescription className="text-inherit">{children}</AlertDescription>
    </AlertPrimitive>
  )
}
