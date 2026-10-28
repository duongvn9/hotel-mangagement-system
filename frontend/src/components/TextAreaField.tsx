import { useId, type TextareaHTMLAttributes } from 'react'

interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string
  error?: string
  /** Gợi ý ngắn dưới ô nhập, ví dụ số ký tự đã dùng. */
  hint?: string
}

/** Ô nhập nhiều dòng có label, gợi ý và thông báo lỗi, cùng kiểu với TextField. */
export function TextAreaField({
  label,
  error,
  hint,
  required,
  className = '',
  ...props
}: TextAreaFieldProps) {
  const id = useId()
  const describedBy = [hint ? `${id}-hint` : '', error ? `${id}-error` : '']
    .filter(Boolean)
    .join(' ')
  return (
    <div className={className}>
      <label
        htmlFor={id}
        className="mb-2 block text-xs font-semibold tracking-wider text-stone-700 uppercase"
      >
        {label}
        {required && <span className="ml-1 text-danger">*</span>}
      </label>
      <textarea
        id={id}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        {...props}
        className={`min-h-28 w-full rounded border bg-white px-4 py-3 text-sm placeholder:text-stone-500 hover:border-stone-500 focus:border-primary disabled:bg-stone-200 disabled:text-stone-500 ${error ? 'border-danger' : 'border-stone-300'}`}
      />
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-stone-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
