import { useId } from 'react'
import { Input, NativeSelect } from '@/components/atoms'
import { FormField } from '@/components/molecules'
export function ReportPeriodFields({
  from,
  to,
  granularity,
  onFrom,
  onTo,
  onGranularity,
  error,
}: {
  from: string
  to: string
  granularity: 'day' | 'month'
  onFrom: (value: string) => void
  onTo: (value: string) => void
  onGranularity: (value: 'day' | 'month') => void
  error?: string
}) {
  const id = useId()
  return (
    <>
      <FormField label="Từ ngày" htmlFor={`${id}-from`} required className="min-w-0">
        <Input
          id={`${id}-from`}
          required
          placeholder="dd/MM/yyyy"
          inputMode="numeric"
          value={from}
          onChange={(e) => onFrom(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-from-error` : undefined}
        />
        {error && (
          <p id={`${id}-from-error`} className="text-xs text-destructive">
            {error}
          </p>
        )}
      </FormField>
      <FormField label="Đến ngày" htmlFor={`${id}-to`} required className="min-w-0">
        <Input
          id={`${id}-to`}
          required
          placeholder="dd/MM/yyyy"
          inputMode="numeric"
          value={to}
          onChange={(e) => onTo(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-to-error` : undefined}
        />
        {error && (
          <p id={`${id}-to-error`} className="text-xs text-destructive">
            {error}
          </p>
        )}
      </FormField>
      <FormField label="Gộp theo" htmlFor={`${id}-granularity`} className="min-w-0">
        <NativeSelect
          id={`${id}-granularity`}
          value={granularity}
          onChange={(e) => onGranularity(e.target.value as 'day' | 'month')}
        >
          <option value="day">Ngày</option>
          <option value="month">Tháng</option>
        </NativeSelect>
      </FormField>
    </>
  )
}
