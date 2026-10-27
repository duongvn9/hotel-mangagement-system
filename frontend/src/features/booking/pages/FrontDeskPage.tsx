import { useState } from 'react'
import { Link } from 'react-router'
import { Alert } from '@/components/Alert'
import { Badge } from '@/components/Badge'
import { TextField } from '@/components/TextField'
import { getErrorMessage } from '@/lib/api-client'
import { BOOKING_STATUS_DISPLAY, type BookingListItem } from '../api'
import { useSameDayList } from '../hooks'
import { formatDate, money, todayISO } from '../utils'

/** UC15 — View Same-Day Check-In/Out List. Lễ tân xem khách đến và khách đi của một ngày. */
export function FrontDeskPage() {
  const [date, setDate] = useState(todayISO())
  const list = useSameDayList(date)
  const data = list.data

  return (
    <section className="mx-auto max-w-container space-y-6 px-4 py-10 font-body">
      <div>
        <p className="text-xs font-semibold tracking-widest text-primary uppercase">Lễ tân</p>
        <h1 className="font-display text-4xl font-semibold text-pearl-900">Đến và đi trong ngày</h1>
        {data && <p className="mt-2 text-sm text-stone-700">Ngày {formatDate(data.date)}</p>}
      </div>

      <div className="max-w-xs rounded-lg border border-stone-300 bg-white p-6">
        <TextField
          label="Ngày"
          type="date"
          required
          value={date}
          onChange={(event) => event.target.value && setDate(event.target.value)}
        />
      </div>

      {list.isError && <Alert tone="danger">{getErrorMessage(list.error)}</Alert>}

      {list.isPending ? (
        <p className="text-stone-700">Đang tải…</p>
      ) : (
        data && (
          <div className="grid items-start gap-6 lg:grid-cols-2">
            <DaySection
              title="Khách đến"
              emptyText="Không có khách đến."
              chipsLabel="Tổng hợp khách đến"
              chips={[
                { label: 'Chưa cọc', count: data.summary.arrivals.awaitingDeposit },
                { label: 'Sẵn sàng', count: data.summary.arrivals.ready },
                { label: 'Đã nhận phòng', count: data.summary.arrivals.checkedIn },
              ]}
              total={data.summary.arrivals.total}
              items={data.arrivals}
            />
            <DaySection
              title="Khách đi"
              emptyText="Không có khách đi."
              chipsLabel="Tổng hợp khách đi"
              chips={[
                { label: 'Chờ trả phòng', count: data.summary.departures.awaitingCheckOut },
                { label: 'Đã trả phòng', count: data.summary.departures.checkedOut },
              ]}
              total={data.summary.departures.total}
              items={data.departures}
            />
          </div>
        )
      )}
    </section>
  )
}

interface DaySectionProps {
  title: string
  emptyText: string
  chipsLabel: string
  chips: { label: string; count: number }[]
  total: number
  items: BookingListItem[]
}

function DaySection({ title, emptyText, chipsLabel, chips, total, items }: DaySectionProps) {
  return (
    <div className="space-y-3">
      <h2 className="font-display text-2xl font-semibold text-pearl-900">
        {title} ({total})
      </h2>
      <ul aria-label={chipsLabel} className="flex flex-wrap gap-2">
        {chips.map((chip) => (
          <li
            key={chip.label}
            className="rounded-full border border-stone-300 bg-white px-3 py-1 text-xs font-semibold text-stone-700"
          >
            {chip.label}: {chip.count}
          </li>
        ))}
      </ul>
      {items.length === 0 ? (
        <p className="rounded-lg border border-stone-300 bg-white p-6 text-stone-700">
          {emptyText}
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((booking) => (
            <BookingRow key={booking.id} booking={booking} />
          ))}
        </ul>
      )}
    </div>
  )
}

function BookingRow({ booking }: { booking: BookingListItem }) {
  const status = BOOKING_STATUS_DISPLAY[booking.status] ?? {
    label: booking.status,
    tone: 'neutral' as const,
  }
  return (
    <li aria-label={booking.code}>
      <Link
        to={`/booking/${booking.id}`}
        className="block space-y-1 rounded-lg border border-stone-300 bg-white p-4 hover:bg-cream-50"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold tracking-wide text-pearl-900">{booking.code}</span>
            <Badge tone={status.tone}>{status.label}</Badge>
          </div>
          <span className="text-sm font-semibold tabular-nums">
            {money.format(booking.roomTotal)}
          </span>
        </div>
        <p className="text-sm text-stone-700">
          {booking.guestName} · {booking.guestPhone}
        </p>
        <p className="text-sm text-stone-700">
          {booking.rooms
            .map((room) => [room.roomNumber, room.roomTypeName].filter(Boolean).join(' · '))
            .join(', ')}{' '}
          · {booking.guests} khách
        </p>
        {booking.status === 'PENDING_DEPOSIT' && (
          <p className="text-xs font-semibold text-warning">Chưa đặt cọc</p>
        )}
      </Link>
    </li>
  )
}
