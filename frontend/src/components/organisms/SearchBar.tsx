import { addDays, format, parseISO } from 'date-fns'
import { Search, Users } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Button } from '../atoms'
import {
  DateRangeField,
  normalizeRange,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../molecules'

export interface SearchValue {
  from: string
  to: string
  guests: number
}

const dayFromToday = (n: number) => format(addDays(new Date(), n), 'yyyy-MM-dd')

export function SearchBar({
  compact,
  initial,
  onSearch,
  onChange,
  ariaLabel = 'Tìm phòng trống',
}: {
  compact?: boolean
  initial?: SearchValue
  onSearch: (value: SearchValue) => void
  /** Báo mỗi khi khách đổi ngày hoặc số khách, kể cả khi chưa bấm tìm. */
  onChange?: (value: SearchValue) => void
  ariaLabel?: string
}) {
  const [from, setFrom] = useState(() => initial?.from ?? dayFromToday(3))
  const [to, setTo] = useState(() => initial?.to ?? dayFromToday(6))
  const [guests, setGuests] = useState(() => String(initial?.guests ?? 2))

  const change = (next: { from?: string; to?: string; guests?: string }) => {
    const value = { from, to, guests, ...next }
    if (next.from !== undefined) setFrom(next.from)
    if (next.to !== undefined) setTo(next.to)
    if (next.guests !== undefined) setGuests(next.guests)
    onChange?.({ from: value.from, to: value.to, guests: Number(value.guests) })
  }

  const handleSubmit = (e?: FormEvent) => {
    e?.preventDefault()
    let validFrom = from
    let validTo = to
    if (!validTo || validTo <= validFrom) {
      const [normalizedFrom, normalizedTo] = normalizeRange(
        parseISO(validFrom || dayFromToday(3)),
        validTo ? parseISO(validTo) : undefined,
      )
      validFrom = normalizedFrom
      validTo = normalizedTo
    }
    onSearch({ from: validFrom, to: validTo, guests: Number(guests) })
  }

  return (
    <form
      role="search"
      aria-label={ariaLabel}
      onSubmit={handleSubmit}
      className={`card-soft flex flex-col gap-3 p-3 md:flex-row md:items-center md:rounded-full md:p-2 md:pl-6 ${compact ? '' : 'shadow-lift'}`}
    >
      <DateRangeField
        from={from}
        to={to}
        onChange={(a, b) => change({ from: a, to: b })}
        className="flex-1 rounded-xl px-2 py-1.5 md:px-0"
      />
      <div className="hidden h-10 w-px bg-border md:block" />
      <div className="flex items-center gap-3 px-2 md:w-48">
        <Users className="size-4 text-primary" />
        <div className="flex-1">
          <div className="text-[11px] tracking-wider text-muted-foreground uppercase">Số khách</div>
          <Select value={guests} onValueChange={(next) => change({ guests: next })}>
            <SelectTrigger className="h-6 border-0 p-0 text-sm font-medium shadow-none focus:ring-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n} khách
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button type="submit" size="lg" className="h-12 rounded-full px-7">
        <Search className="size-4" /> Kiểm tra phòng trống
      </Button>
    </form>
  )
}
