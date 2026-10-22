import { useId, type SelectHTMLAttributes } from 'react'

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  options: { value: string; label: string }[]
}

/** Ô chọn có label theo DESIGN.md mục 7.2. */
export function SelectField({
  label,
  options,
  required,
  className = '',
  ...props
}: SelectFieldProps) {
  const id = useId()
  return (
    <div className={className}>
      <label
        htmlFor={id}
        className="mb-2 block text-xs font-semibold tracking-wider text-stone-700 uppercase"
      >
        {label}
        {required && <span className="ml-1 text-danger">*</span>}
      </label>
      <select
        id={id}
        required={required}
        {...props}
        className="h-11 w-full rounded border border-stone-300 bg-white px-4 text-sm hover:border-stone-500 focus:border-primary disabled:bg-stone-200 disabled:text-stone-500"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}
