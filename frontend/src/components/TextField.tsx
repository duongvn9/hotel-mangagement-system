import { useId, type InputHTMLAttributes } from 'react'

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
}

/** Ô nhập có label và thông báo lỗi theo DESIGN.md mục 7.2. */
export function TextField({ label, error, required, className = '', ...props }: TextFieldProps) {
  const id = useId()
  const errorId = `${id}-error`
  return (
    <div className={className}>
      <label
        htmlFor={id}
        className="mb-2 block text-xs font-semibold tracking-wider text-stone-700 uppercase"
      >
        {label}
        {required && <span className="ml-1 text-danger">*</span>}
      </label>
      <input
        id={id}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        {...props}
        className={`h-11 w-full rounded border bg-white px-4 text-sm placeholder:text-stone-500 hover:border-stone-500 focus:border-primary disabled:bg-stone-200 disabled:text-stone-500 ${error ? 'border-danger' : 'border-stone-300'}`}
      />
      {error && (
        <p id={errorId} className="mt-1 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
