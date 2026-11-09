import { useState } from 'react'
import { Link } from 'react-router'
import { Button, NativeSelect, StatusBadge } from '@/components/atoms'
import { Alert, DateField, FormField } from '@/components/molecules'
import { PageContainer, PageHeader, Panel } from '@/components/organisms'
import { getErrorMessage } from '@/lib/api-client'
import type { BookingListItem } from '../api'
import { CheckoutCharges } from '../components/CheckoutCharges'
import { useCheckIn, useCheckInOptions, useSameDayList } from '../hooks'
import { formatDate, money, todayISO } from '../utils'

/** UC15 — View Same-Day Check-In/Out List. Lễ tân xem khách đến và khách đi của một ngày. */
export function FrontDeskPage() {
  const [date, setDate] = useState(todayISO())
  const list = useSameDayList(date)
  const data = list.data

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        eyebrow="Lễ tân"
        title="Đến và đi trong ngày"
        subtitle={
          data ? `Ngày ${formatDate(data.date)}` : 'Quản lý khách đến và khách đi trong ngày.'
        }
      />

      <div className="card-soft max-w-xs p-5 sm:p-6">
        <FormField label="Ngày" htmlFor="frontdesk-date" required>
          <DateField id="frontdesk-date" value={date} onChange={setDate} />
        </FormField>
      </div>

      {list.isError && <Alert tone="danger">{getErrorMessage(list.error)}</Alert>}

      {list.isPending ? (
        <p className="text-sm text-muted-foreground">Đang tải…</p>
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
    </PageContainer>
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
      <h2 className="font-display text-2xl font-semibold text-foreground">
        {title} ({total})
      </h2>
      <ul aria-label={chipsLabel} className="flex flex-wrap gap-2">
        {chips.map((chip) => (
          <li
            key={chip.label}
            className="inline-flex items-center rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground shadow-sm"
          >
            {chip.label}: {chip.count}
          </li>
        ))}
      </ul>
      {items.length === 0 ? (
        <Panel>
          <p className="text-sm text-muted-foreground">{emptyText}</p>
        </Panel>
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
  return (
    <li aria-label={booking.code} className="card-soft overflow-hidden">
      <Link
        to={`/booking/${booking.id}`}
        className="block space-y-1 p-4 transition-colors hover:bg-surface"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold tracking-wide text-foreground">{booking.code}</span>
            <StatusBadge status={booking.status} />
          </div>
          <span className="text-sm font-semibold tabular-nums text-foreground">
            {money.format(booking.roomTotal)}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          {booking.guestName} · {booking.guestPhone}
        </p>
        <p className="text-sm text-muted-foreground">
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
    <div className="space-y-3 border-t border-border p-4">
      {checkIn.isError && <Alert tone="danger">{getErrorMessage(checkIn.error)}</Alert>}

      {panelOpen && options.isPending && (
        <p className="text-sm text-muted-foreground">Đang tải phòng thay thế…</p>
      )}
      {panelOpen && blocked.length > 0 && (
        <div className="space-y-3 rounded-xl border border-border bg-surface p-4">
          {blocked.map((room) => {
            const taken = Object.entries(selection)
              .filter(([id]) => id !== room.id)
              .map(([, value]) => value)
            const choices = room.replacements.filter((item) => !taken.includes(item.id))
            return (
              <div key={room.id} className="space-y-2">
                <p className="text-sm font-semibold text-foreground">
                  Phòng {room.roomNumber} {ROOM_STATE_LABEL[room.status] ?? room.status}
                </p>
                {room.replacements.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Không có phòng thay thế phù hợp.</p>
                ) : (
                  <FormField
                    label={`Thay phòng ${room.roomNumber} bằng`}
                    htmlFor={`replace-room-${room.id}`}
                  >
                    <NativeSelect
                      id={`replace-room-${room.id}`}
                      value={selection[room.id] ?? ''}
                      onChange={(event) =>
                        setSelection((current) => ({ ...current, [room.id]: event.target.value }))
                      }
                    >
                      <option value="">Chọn phòng</option>
                      {choices.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.roomNumber} (tầng {item.floor})
                        </option>
                      ))}
                    </NativeSelect>
                  </FormField>
                )}
              </div>
            )
          })}
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={!complete || checkIn.isPending}
              className="rounded-full"
              onClick={() =>
                run(blocked.map((room) => ({ from: room.id, to: selection[room.id] as string })))
              }
            >
              Đổi phòng và Check In
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="rounded-full"
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
        <Button
          size="sm"
          disabled={checkIn.isPending}
          className="rounded-full"
          onClick={() => run()}
        >
          Check In
        </Button>
      )}
    </div>
  )
}
