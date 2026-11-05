import type { ReactNode } from 'react'
import { Label } from '../atoms'

/** Nhãn + control + gợi ý + lỗi. Control con phải có `id` trùng `htmlFor`. */
export function FormField({
  label,
  htmlFor,
  error,
  hint,
  required,
  children,
}: {
  label: string
  htmlFor: string
  error?: string
  hint?: string
  required?: boolean
  children: ReactNode
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={htmlFor}>
        {label}
        {required && (
          <span aria-hidden="true" className="text-destructive">
            {' '}
            *
          </span>
        )}
      </Label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
