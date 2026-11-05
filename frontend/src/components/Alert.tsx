import type { ReactNode } from 'react'

const TONES = {
  success: 'bg-success-bg text-success',
  danger: 'bg-danger-bg text-danger',
  info: 'bg-info-bg text-info',
  warning: 'bg-warning-bg text-warning',
}

/**
 * Alert inline theo DESIGN.md cũ.
 * @deprecated Chưa có bản thay thế theo prototype; chờ component mới ở `@/components/molecules` (xem DESIGN.md).
 */
export function Alert({ tone, children }: { tone: keyof typeof TONES; children: ReactNode }) {
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={`rounded px-4 py-3 text-sm ${TONES[tone]}`}
    >
      {children}
    </div>
  )
}
