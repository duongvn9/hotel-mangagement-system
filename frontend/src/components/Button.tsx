import type { ButtonHTMLAttributes } from 'react'

const VARIANTS = {
  primary: 'bg-primary text-white hover:bg-primary-hover',
  secondary: 'border border-pearl-900 text-pearl-900 hover:bg-pearl-900 hover:text-cream-100',
  ghost: 'text-primary hover:bg-brandy-100',
  danger: 'bg-danger text-white hover:brightness-90',
}
const SIZES = { sm: 'h-9 px-4 text-xs', md: 'h-11 px-6 text-sm' }

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof VARIANTS
  size?: keyof typeof SIZES
  loading?: boolean
}

/** Nút theo DESIGN.md mục 7.1. */
export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className = '',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      {...props}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex items-center justify-center gap-2 rounded font-semibold tracking-wider uppercase transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
    >
      {loading ? 'Đang xử lý…' : children}
    </button>
  )
}
