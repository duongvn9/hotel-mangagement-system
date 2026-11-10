import { useState } from 'react'
import { Link } from 'react-router'
import { LogIn, Search } from 'lucide-react'
import { Button, Input, NativeSelect, StatusBadge } from '@/components/atoms'
import { Alert, DateField, EmptyState, FormField } from '@/components/molecules'
import { PageContainer, PageHeader } from '@/components/organisms'
import { getErrorMessage } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import type { BookingListItem } from '../api'
import { CheckInConfirmDialog } from '../components/CheckInConfirmDialog'
import { CheckoutCharges } from '../components/CheckoutCharges'
import { useCheckIn, useCheckInOptions, useSameDayList } from '../hooks'
import { money, todayISO } from '../utils'

function formatShortDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  return `${day}/${month}`
}

/** UC15 — Quầy lễ tân: nhận phòng và trả phòng trong ngày (khớp prototype app.front-desk.tsx). */
export function FrontDeskPage() {
  const [tab, setTab] = useState<'in' | 'out'>('in')
  const [q, setQ] = useState('')
  const [date, setDate] = useState(todayISO())
  const list = useSameDayList(date)
  const data = list.data

  const arrivals = data?.arrivals ?? []
  const departures = data?.departures ?? []

  const filterRows = (rows: BookingListItem[]) =>
    rows.filter((b) => {
      if (!q.trim()) return true
      const query = q.toLowerCase()
      const guest = b.guestName?.toLowerCase() ?? ''
      const code = b.code?.toLowerCase() ?? ''
      const rooms = b.rooms?.map((r) => r.roomNumber?.toLowerCase() ?? '').join(' ') ?? ''
      return guest.includes(query) || code.includes(query) || rooms.includes(query)
    })

  const rows = filterRows(tab === 'in' ? arrivals : departures)

  return (
    <PageContainer className="space-y-6">
      <PageHeader title="Quầy lễ tân" subtitle="Tìm đặt phòng và hoàn tất nhận hoặc trả phòng." />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div
          role="tablist"
          aria-orientation="horizontal"
          className="inline-flex h-9 items-center justify-center rounded-full bg-muted p-1 text-muted-foreground"
        >
          <button
            role="tab"
            aria-selected={tab === 'in'}
            type="button"
            onClick={() => setTab('in')}
            className={cn(
              'inline-flex items-center justify-center whitespace-nowrap rounded-full px-3 py-1 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
              tab === 'in' ? 'bg-background text-foreground shadow-sm' : '',
            )}
          >
            Nhận phòng
          </button>
          <button
            role="tab"
            aria-selected={tab === 'out'}
            type="button"
            onClick={() => setTab('out')}
            className={cn(
              'inline-flex items-center justify-center whitespace-nowrap rounded-full px-3 py-1 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
              tab === 'out' ? 'bg-background text-foreground shadow-sm' : '',
            )}
          >
            Trả phòng
          </button>
        </div>

        <div className="flex flex-col gap-3 sm:ml-auto sm:flex-row sm:items-center">
          <label htmlFor="frontdesk-date" className="sr-only">
            Ngày
          </label>
          <DateField id="frontdesk-date" value={date} onChange={setDate} />
          <div className="relative sm:w-80">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="rounded-full pl-9"
              placeholder="Mã đặt phòng, tên khách hoặc số phòng"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>
      </div>

      <h2 className="sr-only">
        {tab === 'in'
          ? `Khách đến (${data?.summary.arrivals.total ?? arrivals.length})`
          : `Khách đi (${data?.summary.departures.total ?? departures.length})`}
      </h2>

      {list.isError && <Alert tone="danger">{getErrorMessage(list.error)}</Alert>}

      {list.isPending ? (
        <p className="text-sm text-muted-foreground">Đang tải…</p>
      ) : rows.length === 0 ? (
        <EmptyState
          title={tab === 'in' ? 'Không có khách đến.' : 'Không có khách đi.'}
          body={q.trim() ? 'Không tìm thấy đặt phòng phù hợp với từ khóa.' : undefined}
        />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((booking) => (
            <BookingCard key={booking.id} booking={booking} tab={tab} />
          ))}
        </ul>
      )}
    </PageContainer>
  )
}

function BookingCard({ booking, tab }: { booking: BookingListItem; tab: 'in' | 'out' }) {
  const roomNumbers = booking.rooms
    ?.map((r) => r.roomNumber)
    .filter(Boolean)
    .join(', ')
  const roomTypeNames = booking.rooms
    ?.map((r) => r.roomTypeName)
    .filter(Boolean)
    .join(', ')

  return (
    <li aria-label={booking.code} className="card-soft flex flex-col justify-between p-5">
      <div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">{booking.code}</span>
          <StatusBadge status={booking.status} />
        </div>

        <div className="mt-2 text-lg font-semibold text-foreground">
          {booking.guestName || 'Khách'}
        </div>

        <div className="text-sm text-muted-foreground">
          Phòng {roomNumbers || 'Chưa gán'}
          {roomTypeNames ? ` · ${roomTypeNames}` : ''}
        </div>

        <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {formatShortDate(booking.checkIn)} → {formatShortDate(booking.checkOut)}
          </span>
          <span>
            {tab === 'out'
              ? booking.roomTotal
                ? `Tổng ${money.format(booking.roomTotal)}`
                : ''
              : `${booking.adultCount + booking.childCount} khách`}
          </span>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {tab === 'in' ? (
          booking.status === 'CONFIRMED' ? (
            <CheckInAction
              booking={booking}
              detailLink={
                <Button asChild variant="outline" className="rounded-full">
                  <Link to={`/reception/bookings/${encodeURIComponent(booking.code)}`}>
                    Chi tiết
                  </Link>
                </Button>
              }
            />
          ) : (
            <div className="flex gap-2">
              {booking.status === 'PENDING_DEPOSIT' && (
                <Button asChild className="flex-1 rounded-full">
                  <Link
                    to={`/reception/booking/new?${new URLSearchParams({
                      guestName: booking.guestName ?? '',
                      guestEmail: booking.guestEmail ?? '',
                      guestPhone: booking.guestPhone ?? '',
                    }).toString()}`}
                  >
                    Đặt phòng tại quầy
                  </Link>
                </Button>
              )}
              <Button
                asChild
                variant="outline"
                className={cn('rounded-full', booking.status !== 'PENDING_DEPOSIT' && 'w-full')}
              >
                <Link to={`/reception/bookings/${encodeURIComponent(booking.code)}`}>Chi tiết</Link>
              </Button>
            </div>
          )
        ) : booking.status === 'CHECKED_IN' ? (
          <CheckoutCharges
            booking={booking}
            detailLink={
              <Button asChild variant="outline" className="rounded-full">
                <Link to={`/reception/bookings/${encodeURIComponent(booking.code)}`}>Chi tiết</Link>
              </Button>
            }
          />
        ) : (
          <div className="flex gap-2">
            <Button asChild variant="outline" className="w-full rounded-full">
              <Link to={`/reception/bookings/${encodeURIComponent(booking.code)}`}>Chi tiết</Link>
            </Button>
          </div>
        )}
      </div>
    </li>
  )
}

const ROOM_STATE_LABEL: Record<string, string> = {
  CLEANING: 'đang dọn',
  OCCUPIED: 'đang có khách',
  MAINTENANCE: 'đang bảo trì',
  INACTIVE: 'đã ngừng hoạt động',
}

function CheckInAction({
  booking,
  detailLink,
}: {
  booking: BookingListItem
  detailLink?: React.ReactNode
}) {
  const checkIn = useCheckIn()
  const [panelOpen, setPanelOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [selection, setSelection] = useState<Record<string, string>>({})
  const options = useCheckInOptions(panelOpen ? booking.id : null)
  const blocked = options.data?.rooms.filter((room) => !room.ready) ?? []

  async function run(replacements?: { from: string; to: string }[]) {
    try {
      await checkIn.mutateAsync({ id: booking.id, ...(replacements ? { replacements } : {}) })
      setPanelOpen(false)
    } catch {
      setPanelOpen(true)
    }
  }

  const complete = blocked.length > 0 && blocked.every((room) => Boolean(selection[room.id]))

  return (
    <div className="space-y-3">
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
        <div className="flex gap-2">
          <Button
            disabled={checkIn.isPending}
            className="flex-1 rounded-full"
            aria-label="Check In"
            onClick={() => {
              checkIn.reset()
              setConfirmOpen(true)
            }}
          >
            <LogIn className="mr-1.5 size-4" />
            Nhận phòng
          </Button>
          {detailLink}
        </div>
      )}
      {panelOpen && blocked.length > 0 && detailLink && (
        <div className="flex gap-2">{detailLink}</div>
      )}

      <CheckInConfirmDialog
        booking={booking}
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        pending={checkIn.isPending}
        onConfirm={async () => {
          // Lỗi (vd phòng chưa sẵn sàng) hiện ở thẻ khách, không giữ hộp thoại mở.
          await run()
          setConfirmOpen(false)
        }}
      />
    </div>
  )
}
