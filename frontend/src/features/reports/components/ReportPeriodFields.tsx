import { TextField } from '@/components/TextField'
import { SelectField } from '@/components/SelectField'
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
  return (
    <>
      <TextField
        label="Từ ngày"
        required
        placeholder="dd/MM/yyyy"
        inputMode="numeric"
        value={from}
        onChange={(e) => onFrom(e.target.value)}
        error={error}
      />
      <TextField
        label="Đến ngày"
        required
        placeholder="dd/MM/yyyy"
        inputMode="numeric"
        value={to}
        onChange={(e) => onTo(e.target.value)}
        error={error}
      />
      <SelectField
        label="Gộp theo"
        value={granularity}
        onChange={(e) => onGranularity(e.target.value as 'day' | 'month')}
        options={[
          { value: 'day', label: 'Ngày' },
          { value: 'month', label: 'Tháng' },
        ]}
      />
    </>
  )
}
