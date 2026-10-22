import type { ReactNode } from 'react'

const TONES = {
  success: 'bg-success-bg text-success',
  danger: 'bg-danger-bg text-danger',
  info: 'bg-info-bg text-info',
  warning: 'bg-warning-bg text-warning',
  neutral: 'bg-stone-200 text-stone-700',
}

/** Status chip theo DESIGN.md mục 7.7: luôn có chữ, không chỉ dùng màu. */
export function Badge({ tone, children }: { tone: keyof typeof TONES; children: ReactNode }) {
  return (
    <span
      className={`inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold whitespace-nowrap ${TONES[tone]}`}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {children}
    </span>
  )
}
