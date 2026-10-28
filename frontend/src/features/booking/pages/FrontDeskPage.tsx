import { useState } from 'react'
import { Link } from 'react-router'
import { Alert } from '@/components/Alert'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { SelectField } from '@/components/SelectField'
import { TextField } from '@/components/TextField'
import { getErrorMessage } from '@/lib/api-client'
import { BOOKING_STATUS_DISPLAY, type BookingListItem } from '../api'
import { CheckoutCharges } from '../components/CheckoutCharges'
import { useCheckIn, useCheckInOptions, useSameDayList } from '../hooks'
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
              canCheckIn
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
              canRecordCharges
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
  /** Cho phép Check In ở các booking đã xác nhận (danh sách khách đến). */
  canCheckIn?: boolean
  /** Cho phép ghi phụ phí ở các booking đang ở (danh sách khách đi). */
  canRecordCharges?: boolean
}

function DaySection({
  title,
  emptyText,
  chipsLabel,
  chips,
  total,
  items,
  canCheckIn = false,
  canRecordCharges = false,
}: DaySectionProps) {
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
            <BookingRow
              key={booking.id}
              booking={booking}
              canCheckIn={canCheckIn}
              canRecordCharges={canRecordCharges}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

function BookingRow({
  booking,
  canCheckIn,
  canRecordCharges,
}: {
  booking: BookingListItem
  canCheckIn: boolean
  canRecordCharges: boolean
}) {
  const status = BOOKING_STATUS_DISPLAY[booking.status] ?? {
    label: booking.status,
    tone: 'neutral' as const,
  }
  return (
    <li aria-label={booking.code} className="rounded-lg border border-stone-300 bg-white">
      <Link
        to={`/booking/${booking.id}`}
        className="block space-y-1 rounded-lg p-4 hover:bg-cream-50"
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
          · {booking.adultCount + booking.childCount} khách
        </p>
        {booking.status === 'PENDING_DEPOSIT' && (
          <p className="text-xs font-semibold text-warning">Chưa đặt cọc</p>
        )}
      </Link>
      {canCheckIn && booking.status === 'CONFIRMED' && <CheckInAction booking={booking} />}
      {canRecordCharges && booking.status === 'CHECKED_IN' && <CheckoutCharges booking={booking} />}
    </li>
  )
}

const ROOM_STATE_LABEL: Record<string, string> = {
  CLEANING: 'đang dọn',
  OCCUPIED: 'đang có khách',
  MAINTENANCE: 'đang bảo trì',
  INACTIVE: 'đã ngừng hoạt động',
}

/**
 * UC16 — nút Check In. Nếu phòng chưa sẵn sàng thì server từ chối; khi đó lấy danh sách phòng
 * chưa sẵn sàng cùng phòng thay thế hợp lệ để lễ tân đổi phòng rồi nhận phòng.
 */
function CheckInAction({ booking }: { booking: BookingListItem }) {
  const checkIn = useCheckIn()
  const [panelOpen, setPanelOpen] = useState(false)
  const [selection, setSelection] = useState<Record<string, string>>({})
  const options = useCheckInOptions(panelOpen ? booking.id : null)
  const blocked = options.data?.rooms.filter((room) => !room.ready) ?? []

  async function run(replacements?: { from: string; to: string }[]) {
    try {
      await checkIn.mutateAsync({ id: booking.id, ...(replacements ? { replacements } : {}) })
      setPanelOpen(false)
    } catch {
      // Lỗi hiển thị qua checkIn.error; mở khung đổi phòng nếu nguyên nhân là phòng chưa sẵn sàng.
      setPanelOpen(true)
    }
  }

  const complete = blocked.length > 0 && blocked.every((room) => Boolean(selection[room.id]))

  return (
    <div className="space-y-3 border-t border-stone-200 p-4">
      {checkIn.isError && <Alert tone="danger">{getErrorMessage(checkIn.error)}</Alert>}

      {panelOpen && options.isPending && (
        <p className="text-sm text-stone-700">Đang tải phòng thay thế…</p>
      )}
      {panelOpen && blocked.length > 0 && (
        <div className="space-y-3 rounded border border-stone-300 bg-cream-50 p-3">
          {blocked.map((room) => {
            const taken = Object.entries(selection)
              .filter(([id]) => id !== room.id)
              .map(([, value]) => value)
            const choices = room.replacements.filter((item) => !taken.includes(item.id))
            return (
              <div key={room.id} className="space-y-2">
                <p className="text-sm font-semibold text-pearl-900">
                  Phòng {room.roomNumber} {ROOM_STATE_LABEL[room.status] ?? room.status}
                </p>
                {room.replacements.length === 0 ? (
                  <p className="text-sm text-stone-700">Không có phòng thay thế phù hợp.</p>
                ) : (
                  <SelectField
                    label={`Thay phòng ${room.roomNumber} bằng`}
                    value={selection[room.id] ?? ''}
                    options={[
                      { value: '', label: 'Chọn phòng' },
                      ...choices.map((item) => ({
                        value: item.id,
                        label: `${item.roomNumber} (tầng ${item.floor})`,
                      })),
                    ]}
                    onChange={(event) =>
                      setSelection((current) => ({ ...current, [room.id]: event.target.value }))
                    }
                  />
                )}
              </div>
            )
          })}
          <div className="flex flex-wrap gap-3">
            <Button
              size="sm"
              disabled={!complete}
              loading={checkIn.isPending}
              onClick={() =>
                run(blocked.map((room) => ({ from: room.id, to: selection[room.id] as string })))
              }
            >
              Đổi phòng và Check In
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setPanelOpen(false)
                checkIn.reset()
              }}
            >
              Đóng
            </Button>
          </div>
        </div>
      )}

      {!(panelOpen && blocked.length > 0) && (
        <Button size="sm" loading={checkIn.isPending} onClick={() => run()}>
          Check In
        </Button>
      )}
    </div>
  )
}
