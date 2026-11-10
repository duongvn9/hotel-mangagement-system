import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Button, Input, NativeSelect, StatusBadge } from '@/components/atoms'
import { EmptyState, FormField } from '@/components/molecules'
import { PageContainer, PageHeader, Pager } from '@/components/organisms'
import { getErrorMessage } from '@/lib/api-client'
import { fdate, vnd } from '@/lib/format'
import { BOOKING_STATUS_DISPLAY, type MyBookingItem } from '../api'
import { useMyBookings } from '../hooks'

const NO_BOOKINGS: MyBookingItem[] = []

const PAGE_SIZE = 8

type SortKey = 'checkin-desc' | 'checkin-asc' | 'created-desc'

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'checkin-desc', label: 'Nhận phòng: mới nhất' },
  { value: 'checkin-asc', label: 'Nhận phòng: cũ nhất' },
  { value: 'created-desc', label: 'Vừa đặt gần đây' },
]

const STATUS_OPTIONS = [
  { value: '', label: 'Tất cả trạng thái' },
  ...Object.entries(BOOKING_STATUS_DISPLAY).map(([value, { label }]) => ({ value, label })),
]

/**
 * UC09/UC10 — "Đặt phòng của tôi" cho Customer đăng nhập: đọc booking gắn với tài khoản
 * từ server (GET /bookings/mine). Màn này yêu cầu đăng nhập (RequireAuth ở route); khách
 * vãng lai tra cứu đơn bằng mã ở trang /booking/lookup. Sắp xếp và lọc xử lý phía client
 * vì endpoint trả toàn bộ đơn của khách (thường ít).
 */
export function MyBookingsPage() {
  const query = useMyBookings()
  const bookings = query.data ?? NO_BOOKINGS

  const [sort, setSort] = useState<SortKey>('checkin-desc')
  const [status, setStatus] = useState('')
  const [checkInFrom, setCheckInFrom] = useState('')
  const [checkInTo, setCheckInTo] = useState('')
  const [page, setPage] = useState(1)

  const visible = useMemo(() => {
    const filtered = bookings.filter((b) => {
      if (status && b.status !== status) return false
      const day = b.checkIn.slice(0, 10)
      if (checkInFrom && day < checkInFrom) return false
      if (checkInTo && day > checkInTo) return false
      return true
    })
    filtered.sort((a, b) => {
      if (sort === 'created-desc') return b.createdAt.localeCompare(a.createdAt)
      if (sort === 'checkin-asc') return a.checkIn.localeCompare(b.checkIn)
      return b.checkIn.localeCompare(a.checkIn)
    })
    return filtered
  }, [bookings, sort, status, checkInFrom, checkInTo])

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pageItems = visible.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title="Đặt phòng của tôi"
        subtitle="Xem, theo dõi và quản lý các đơn đặt phòng của bạn."
        actions={
          <Button asChild className="rounded-full">
            <Link to="/search">Tìm phòng mới</Link>
          </Button>
        }
      />

      {query.isPending && (
        <div role="status" className="py-8">
          <p className="text-muted-foreground">Đang tải đặt phòng của bạn…</p>
        </div>
      )}

      {query.isError && (
        <div
          role="alert"
          className="rounded-xl border border-destructive/20 bg-destructive/10 p-5 text-destructive"
        >
          {getErrorMessage(query.error, 'Không tải được danh sách đặt phòng.')}
        </div>
      )}

      {query.isSuccess && bookings.length === 0 && (
        <EmptyState
          title="Bạn chưa có đặt phòng nào"
          body="Hãy tìm phòng để bắt đầu kỳ nghỉ tuyệt vời cùng Emily Hotel."
          action={
            <Button asChild className="rounded-full">
              <Link to="/search">Đặt phòng ngay</Link>
            </Button>
          }
        />
      )}

      {bookings.length > 1 && (
        <div
          className="card-soft grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4"
          aria-label="Sắp xếp và lọc đặt phòng"
        >
          <FormField label="Sắp xếp" htmlFor="my-bookings-sort">
            <NativeSelect
              id="my-bookings-sort"
              value={sort}
              onChange={(event) => {
                setSort(event.target.value as SortKey)
                setPage(1)
              }}
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField label="Trạng thái" htmlFor="my-bookings-status">
            <NativeSelect
              id="my-bookings-status"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value)
                setPage(1)
              }}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField label="Nhận phòng từ" htmlFor="my-bookings-from">
            <Input
              id="my-bookings-from"
              type="date"
              value={checkInFrom}
              onChange={(event) => {
                setCheckInFrom(event.target.value)
                setPage(1)
              }}
            />
          </FormField>
          <FormField label="Nhận phòng đến" htmlFor="my-bookings-to">
            <Input
              id="my-bookings-to"
              type="date"
              min={checkInFrom || undefined}
              value={checkInTo}
              onChange={(event) => {
                setCheckInTo(event.target.value)
                setPage(1)
              }}
            />
          </FormField>
        </div>
      )}

      {bookings.length > 0 && visible.length === 0 && (
        <p className="text-sm text-muted-foreground">Không có đặt phòng nào khớp bộ lọc.</p>
      )}

      {visible.length > 0 && (
        <div className="grid gap-4">
          {pageItems.map((booking) => (
            <Link
              key={booking.id}
              to={`/booking/${booking.id}`}
              className="card-soft flex flex-col gap-4 p-5 transition hover:shadow-lift sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <span className="font-semibold tracking-wide text-foreground">
                    {booking.code}
                  </span>
                  <StatusBadge status={booking.status} />
                </div>
                <p className="text-sm text-muted-foreground">
                  {fdate(booking.checkIn)} → {fdate(booking.checkOut)} · {booking.roomCount} phòng ·{' '}
                  {booking.adultCount + booking.childCount} khách
                </p>
              </div>
              <div className="sm:text-right">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Tiền cọc</p>
                <p className="font-semibold text-primary tabular-nums">
                  {vnd(booking.depositAmount)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-end pt-2 text-sm text-muted-foreground">
          <Pager
            page={currentPage}
            totalPages={totalPages}
            onPrev={() => setPage(currentPage - 1)}
            onNext={() => setPage(currentPage + 1)}
          />
        </div>
      )}
    </PageContainer>
  )
}
