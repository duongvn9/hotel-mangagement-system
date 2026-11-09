import { format, isValid, parseISO } from 'date-fns'
import { vi } from 'date-fns/locale'
import { CalendarIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Calendar } from '../ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'

function parse(value: string): Date | undefined {
  const date = parseISO(value)
  return isValid(date) ? date : undefined
}

/** Ô chọn một ngày (popover + lịch), thay cho `<input type="date">` mặc định của trình duyệt. */
export function DateField({
  id,
  value,
  onChange,
  className,
}: {
  id?: string
  value: string
  onChange: (value: string) => void
  className?: string
}) {
  const selected = parse(value)
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          className={cn(
            'flex h-9 w-full items-center gap-2 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
            className,
          )}
        >
          <CalendarIcon className="size-4 shrink-0 text-primary" />
          <span className={cn('flex-1 text-left', !selected && 'text-muted-foreground')}>
            {selected ? format(selected, 'EEEE, dd/MM/yyyy', { locale: vi }) : 'Chọn ngày'}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          locale={vi}
          mode="single"
          selected={selected}
          defaultMonth={selected}
          onSelect={(date) => {
            if (date) onChange(format(date, 'yyyy-MM-dd'))
          }}
          className="pointer-events-auto p-3"
        />
      </PopoverContent>
    </Popover>
  )
}
