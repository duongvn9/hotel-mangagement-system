import { useMemo, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Pencil, UserPlus } from 'lucide-react'
import { Badge, Button, Input, NativeSelect, StatusBadge } from '@/components/atoms'
import { Alert, FormField } from '@/components/molecules'
import { PageContainer, PageHeader, Panel } from '@/components/organisms'
import { BookingAttentionAlert } from '../components/BookingAttentionAlert'
import { getErrorMessage } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import { BOOKING_STATUS_DISPLAY, type BookingListParams } from '../api'
import { ATTENTION_META, classifyAttention } from '../attention'
import { useBookingList } from '../hooks'
import { formatDate, money, todayISO } from '../utils'

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

  // Đánh dấu đơn cần xử lý và đưa chúng lên đầu trang (quá hạn trước, rồi tới hạn hôm nay).
  const today = todayISO()
  const rows = useMemo(() => {
    const items = list.data?.items ?? []
    return items
      .map((booking) => ({ booking, attention: classifyAttention(booking, today) }))
      .sort(
        (a, b) =>
          (a.attention ? ATTENTION_META[a.attention].priority : 99) -
          (b.attention ? ATTENTION_META[b.attention].priority : 99),
      )
  }, [list.data?.items, today])

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
    <PageContainer className="space-y-6">
      <PageHeader
        eyebrow="Lễ tân"
        title="Danh sách booking"
        subtitle="Tìm kiếm, lọc và mở bất kỳ đặt phòng nào."
        actions={
          <Button asChild className="rounded-full">
            <Link to="/reception/booking/new">
              <UserPlus className="size-4" />
              Tạo booking
            </Link>
          </Button>
        }
      />

      <BookingAttentionAlert showLink={false} />

      <form
        onSubmit={applyFilters}
        className="card-soft grid gap-4 p-5 sm:p-6 md:grid-cols-5"
        aria-label="Lọc booking"
      >
        <FormField label="Tìm kiếm" htmlFor="booking-search-q" className="md:col-span-2">
          <Input
            id="booking-search-q"
            placeholder="Mã, tên, email, số điện thoại"
            maxLength={100}
            value={draft.q}
            onChange={(event) => setDraft({ ...draft, q: event.target.value })}
          />
        </FormField>
        <FormField label="Trạng thái" htmlFor="booking-search-status">
          <NativeSelect
            id="booking-search-status"
            value={draft.status}
            onChange={(event) => setDraft({ ...draft, status: event.target.value })}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField label="Nhận phòng từ" htmlFor="booking-search-from">
          <Input
            id="booking-search-from"
            type="date"
            value={draft.checkInFrom}
            onChange={(event) => setDraft({ ...draft, checkInFrom: event.target.value })}
          />
        </FormField>
        <FormField label="Nhận phòng đến" htmlFor="booking-search-to">
          <Input
            id="booking-search-to"
            type="date"
            min={draft.checkInFrom || undefined}
            value={draft.checkInTo}
            onChange={(event) => setDraft({ ...draft, checkInTo: event.target.value })}
          />
        </FormField>
        <div className="flex gap-3 md:col-span-5">
          <Button type="submit" disabled={list.isFetching} className="rounded-full">
            Lọc
          </Button>
          <Button type="button" variant="ghost" onClick={resetFilters} className="rounded-full">
            Xoá bộ lọc
          </Button>
        </div>
      </form>

      {list.isError && <Alert tone="danger">{getErrorMessage(list.error)}</Alert>}

      {list.isPending ? (
        <p className="text-sm text-muted-foreground">Đang tải…</p>
      ) : list.data && list.data.items.length === 0 ? (
        <Panel>
          <p className="text-sm text-muted-foreground">Không có booking nào phù hợp.</p>
        </Panel>
      ) : (
        list.data && (
          <>
            <ul className="space-y-3">
              {rows.map(({ booking, attention }) => (
                <li
                  key={booking.id}
                  className="card-soft flex items-center gap-3 p-5 transition-colors hover:bg-surface"
                >
                  <Link
                    to={`/reception/bookings/${encodeURIComponent(booking.code)}`}
                    className="grid flex-1 gap-3 md:grid-cols-[1.2fr_1fr_1fr_auto] md:items-center"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold tracking-wide text-foreground">
                          {booking.code}
                        </span>
                        <StatusBadge status={booking.status} />
                        {booking.source === 'FRONT_DESK' && <Badge tone="info">Tại quầy</Badge>}
                        {attention && (
                          <Badge tone={ATTENTION_META[attention].tone}>
                            {ATTENTION_META[attention].label}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-foreground">{booking.guestName}</p>
                      <p className="text-xs text-muted-foreground">
                        {booking.guestPhone} · {booking.guestEmail}
                      </p>
                    </div>
                    <div className="space-y-1 text-sm">
                      <p className="font-semibold text-foreground">
                        {formatDate(booking.checkIn)} – {formatDate(booking.checkOut)}
                      </p>
                      <p className="text-muted-foreground">
                        {booking.adultCount + booking.childCount} khách
                      </p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {booking.rooms
                        .map((room) =>
                          [room.roomNumber, room.roomTypeName].filter(Boolean).join(' · '),
                        )
                        .join(', ')}
                    </p>
                    <p className="font-semibold tabular-nums text-foreground md:text-right">
                      {money.format(booking.roomTotal)}
                    </p>
                  </Link>
                  <div
                    className={cn(
                      'flex items-center justify-end sm:w-20 sm:shrink-0',
                      !EDITABLE_STATUSES.includes(booking.status) && 'hidden sm:flex',
                    )}
                  >
                    {EDITABLE_STATUSES.includes(booking.status) && (
                      <Button asChild variant="outline" size="sm" className="rounded-full">
                        <Link to={`/reception/bookings/${encodeURIComponent(booking.code)}/edit`}>
                          <Pencil className="size-4" />
                          Sửa
                        </Link>
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>

            <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
              <p className="text-sm text-muted-foreground">
                Trang {list.data.page} / {totalPages} · {list.data.total} booking
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pageNumber <= 1}
                  onClick={() => setPageNumber((current) => current - 1)}
                  className="rounded-full"
                >
                  Trang trước
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pageNumber >= totalPages}
                  onClick={() => setPageNumber((current) => current + 1)}
                  className="rounded-full"
                >
                  Trang sau
                </Button>
              </div>
            </div>
          </>
        )
      )}
    </PageContainer>
  )
}
