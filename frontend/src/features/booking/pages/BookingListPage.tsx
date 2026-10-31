import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Alert } from '@/components/Alert'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { SelectField } from '@/components/SelectField'
import { TextField } from '@/components/TextField'
import { getErrorMessage } from '@/lib/api-client'
import { BOOKING_STATUS_DISPLAY, type BookingListParams } from '../api'
import { useBookingList } from '../hooks'
import { formatDate, money } from '../utils'

const PAGE_SIZE = 20

/** Trạng thái còn sửa được (UC11): trước khi nhận phòng và chưa huỷ. */
const EDITABLE_STATUSES = ['PENDING_DEPOSIT', 'CONFIRMED']

const STATUS_OPTIONS = [
  { value: '', label: 'Tất cả' },
  ...Object.entries(BOOKING_STATUS_DISPLAY).map(([value, { label }]) => ({ value, label })),
]

interface Filters {
  q: string
  status: string
  checkInFrom: string
  checkInTo: string
}

const EMPTY_FILTERS: Filters = { q: '', status: '', checkInFrom: '', checkInTo: '' }

/** UC10 — View Booking List. Lễ tân/Quản lý tra cứu booking theo trạng thái, từ khoá và ngày nhận phòng. */
export function BookingListPage() {
  // Từ trang tìm khách (UC14): mở sẵn danh sách đã lọc theo email của khách.
  const [searchParams] = useSearchParams()
  const [initial] = useState<Filters>(() => ({
    ...EMPTY_FILTERS,
    q: (searchParams.get('q') ?? '').trim().slice(0, 100),
  }))
  const [draft, setDraft] = useState<Filters>(initial)
  const [applied, setApplied] = useState<Filters>(initial)
  const [pageNumber, setPageNumber] = useState(1)

  const params: BookingListParams = {
    page: pageNumber,
    limit: PAGE_SIZE,
    ...(applied.q ? { q: applied.q } : {}),
    ...(applied.status ? { status: applied.status } : {}),
    ...(applied.checkInFrom ? { checkInFrom: applied.checkInFrom } : {}),
    ...(applied.checkInTo ? { checkInTo: applied.checkInTo } : {}),
  }
  const list = useBookingList(params)
  const totalPages = Math.max(1, Math.ceil((list.data?.total ?? 0) / PAGE_SIZE))

  function applyFilters(event: FormEvent) {
    event.preventDefault()
    setApplied({ ...draft, q: draft.q.trim() })
    setPageNumber(1)
  }

  function resetFilters() {
    setDraft(EMPTY_FILTERS)
    setApplied(EMPTY_FILTERS)
    setPageNumber(1)
  }

  return (
    <section className="mx-auto max-w-container space-y-6 px-4 py-10 font-body">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-widest text-primary uppercase">Lễ tân</p>
          <h1 className="font-display text-4xl font-semibold text-pearl-900">Danh sách booking</h1>
        </div>
        <Link to="/reception/booking/new">
          <Button>Tạo booking</Button>
        </Link>
      </div>

      <form
        onSubmit={applyFilters}
        className="grid gap-4 rounded-lg border border-stone-300 bg-white p-6 md:grid-cols-5"
        aria-label="Lọc booking"
      >
        <TextField
          label="Tìm kiếm"
          placeholder="Mã, tên, email, số điện thoại"
          maxLength={100}
          value={draft.q}
          onChange={(event) => setDraft({ ...draft, q: event.target.value })}
          className="md:col-span-2"
        />
        <SelectField
          label="Trạng thái"
          options={STATUS_OPTIONS}
          value={draft.status}
          onChange={(event) => setDraft({ ...draft, status: event.target.value })}
        />
        <TextField
          label="Nhận phòng từ"
          type="date"
          value={draft.checkInFrom}
          onChange={(event) => setDraft({ ...draft, checkInFrom: event.target.value })}
        />
        <TextField
          label="Nhận phòng đến"
          type="date"
          min={draft.checkInFrom || undefined}
          value={draft.checkInTo}
          onChange={(event) => setDraft({ ...draft, checkInTo: event.target.value })}
        />
        <div className="flex gap-3 md:col-span-5">
          <Button type="submit" loading={list.isFetching}>
            Lọc
          </Button>
          <Button type="button" variant="ghost" onClick={resetFilters}>
            Xoá bộ lọc
          </Button>
        </div>
      </form>

      {list.isError && <Alert tone="danger">{getErrorMessage(list.error)}</Alert>}

      {list.isPending ? (
        <p className="text-stone-700">Đang tải…</p>
      ) : list.data && list.data.items.length === 0 ? (
        <p className="rounded-lg border border-stone-300 bg-white p-6 text-stone-700">
          Không có booking nào phù hợp.
        </p>
      ) : (
        list.data && (
          <>
            <ul className="space-y-3">
              {list.data.items.map((booking) => {
                const display = BOOKING_STATUS_DISPLAY[booking.status] ?? {
                  label: booking.status,
                  tone: 'neutral' as const,
                }
                return (
                  <li key={booking.id} className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
                    <Link
                      to={`/reception/bookings/${encodeURIComponent(booking.code)}`}
                      className="grid flex-1 gap-3 rounded-lg border border-stone-300 bg-white p-5 hover:bg-cream-50 md:grid-cols-[1.2fr_1fr_1fr_auto] md:items-center"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold tracking-wide text-pearl-900">
                            {booking.code}
                          </span>
                          <Badge tone={display.tone}>{display.label}</Badge>
                          {booking.source === 'FRONT_DESK' && <Badge tone="info">Tại quầy</Badge>}
                        </div>
                        <p className="text-sm text-stone-700">{booking.guestName}</p>
                        <p className="text-xs text-stone-500">
                          {booking.guestPhone} · {booking.guestEmail}
                        </p>
                      </div>
                      <div className="space-y-1 text-sm">
                        <p className="font-semibold">
                          {formatDate(booking.checkIn)} – {formatDate(booking.checkOut)}
                        </p>
                        <p className="text-stone-700">
                          {booking.adultCount + booking.childCount} khách
                        </p>
                      </div>
                      <p className="text-sm text-stone-700">
                        {booking.rooms
                          .map((room) =>
                            [room.roomNumber, room.roomTypeName].filter(Boolean).join(' · '),
                          )
                          .join(', ')}
                      </p>
                      <p className="font-semibold tabular-nums md:text-right">
                        {money.format(booking.roomTotal)}
                      </p>
                    </Link>
                    {EDITABLE_STATUSES.includes(booking.status) && (
                      <Link
                        to={`/reception/bookings/${encodeURIComponent(booking.code)}/edit`}
                        className="inline-flex items-center justify-center rounded border border-pearl-900 px-5 text-xs font-semibold tracking-wider text-pearl-900 uppercase hover:bg-pearl-900 hover:text-cream-100"
                      >
                        Sửa
                      </Link>
                    )}
                  </li>
                )
              })}
            </ul>

            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="text-sm text-stone-700">
                Trang {list.data.page} / {totalPages} · {list.data.total} booking
              </p>
              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={pageNumber <= 1}
                  onClick={() => setPageNumber((current) => current - 1)}
                >
                  Trang trước
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={pageNumber >= totalPages}
                  onClick={() => setPageNumber((current) => current + 1)}
                >
                  Trang sau
                </Button>
              </div>
            </div>
          </>
        )
      )}
    </section>
  )
}
