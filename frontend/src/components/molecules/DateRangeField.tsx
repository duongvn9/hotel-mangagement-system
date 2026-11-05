import { format, isValid, parseISO, startOfToday } from 'date-fns'
import { vi } from 'date-fns/locale'
import { CalendarIcon } from 'lucide-react'
import type { DateRange } from 'react-day-picker'
import { cn } from '@/lib/utils'
import { Calendar } from '../ui/calendar'
import { normalizeRange } from './date-range'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'

function parse(value: string): Date | undefined {
  const date = parseISO(value)
  return isValid(date) ? date : undefined
}

export function DateRangeField({
  from,
  to,
  onChange,
  className,
}: {
  from: string
  to: string
  onChange: (from: string, to: string) => void
  className?: string
}) {
  const start = parse(from)
  const end = parse(to)
  const range: DateRange | undefined = start ? { from: start, to: end } : undefined
  const text =
    start && end
      ? `${format(start, 'EEE, dd/MM', { locale: vi })} — ${format(end, 'EEE, dd/MM', { locale: vi })}`
      : 'Chọn ngày'
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className={cn('flex items-center gap-3 text-left', className)}>
          <CalendarIcon className="size-4 text-primary" />
          <span>
            <span className="block text-[11px] tracking-wider text-muted-foreground uppercase">
              Nhận phòng — Trả phòng
            </span>
            <span className="text-sm font-medium">{text}</span>
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          locale={vi}
          mode="range"
          numberOfMonths={2}
          selected={range}
          disabled={(date) => date < startOfToday()}
          onSelect={(r) => {
            if (r?.from) onChange(...normalizeRange(r.from, r.to))
          }}
          className="pointer-events-auto p-3"
        />
      </PopoverContent>
    </Popover>
  )
}
