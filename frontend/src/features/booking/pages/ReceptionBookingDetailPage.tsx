import { ChevronLeft, Pencil } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { Button, StatusBadge } from '@/components/atoms'
import { Alert, EmptyState, KeyValue } from '@/components/molecules'
import { PageContainer, Panel } from '@/components/organisms'
import { getErrorMessage } from '@/lib/api-client'
import { fdate, vnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { BookingListItem } from '../api'
import { useBookingCharges, useBookingList } from '../hooks'
import { nightsBetween } from '../utils'

/** Trạng thái còn sửa được (UC11): trước khi nhận phòng và chưa huỷ. */
const EDITABLE_STATUSES = ['PENDING_DEPOSIT', 'CONFIRMED']

/**
 * UC09 — View Booking Detail (bản cho Lễ tân/Quản lý), theo màn app.bookings.$id của prototype:
 * lưu trú, hoá đơn và khách. Chưa có API đọc chi tiết theo mã nên dùng lại danh sách (UC10) lọc
 * theo mã, giống trang Sửa booking; hoá đơn lấy từ GET /bookings/:id/charges.
 */
export function ReceptionBookingDetailPage() {
  const { code = '' } = useParams()
  const list = useBookingList({ page: 1, limit: 20, q: code })
  const booking = list.data?.items.find((entry) => entry.code === code)

  return (
    <PageContainer className="space-y-6">
      <Link
        to="/reception/bookings"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        Đặt phòng
      </Link>

      {list.isPending && (
        <div role="status" className="py-8">
          <p className="text-muted-foreground">Đang tải…</p>
        </div>
      )}

      {list.isError && <Alert tone="danger">{getErrorMessage(list.error)}</Alert>}

      {list.isSuccess && !booking && (
        <EmptyState
          title="Không tìm thấy booking"
          body="Booking có thể đã bị xoá hoặc mã không đúng."
          action={
            <Button asChild variant="outline" className="rounded-full">
              <Link to="/reception/bookings">Về danh sách booking</Link>
            </Button>
          }
        />
      )}

      {booking && <ReceptionBookingDetail booking={booking} />}
    </PageContainer>
  )
}

function ReceptionBookingDetail({ booking }: { booking: BookingListItem }) {
  const charges = useBookingCharges(booking.id)
  const totals = charges.data?.totals
  const nights = nightsBetween(booking.checkIn, booking.checkOut)
  const roomTypes = [...new Set(booking.rooms.map((room) => room.roomTypeName).filter(Boolean))]
  const roomNumbers = booking.rooms.map((room) => room.roomNumber).filter(Boolean)
  const editable = EDITABLE_STATUSES.includes(booking.status)
  const paid = totals ? totals.depositPaid + totals.finalPaid : 0

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold break-words">{booking.code}</h1>
            <StatusBadge status={booking.status} />
            <StatusBadge status={booking.source === 'FRONT_DESK' ? 'WALK_IN' : booking.source} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {[
              booking.guestName,
              roomTypes.join(', '),
              roomNumbers.length > 0 ? `Phòng ${roomNumbers.join(', ')}` : '',
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        {editable && (
          <Button asChild variant="outline" className="rounded-full">
            <Link to={`/reception/bookings/${encodeURIComponent(booking.code)}/edit`}>
              <Pencil className="size-4" />
              Sửa booking
            </Link>
          </Button>
        )}
      </div>
      {!editable && (
        <p className="text-xs text-muted-foreground">
          Booking ở trạng thái này không còn sửa được.
        </p>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_360px]">
        <Panel title="Lưu trú">
          <div className="grid gap-x-8 sm:grid-cols-2">
            <KeyValue k="Nhận phòng" v={fdate(booking.checkIn)} />
            <KeyValue k="Trả phòng" v={fdate(booking.checkOut)} />
            <KeyValue k="Số đêm" v={nights} />
            <KeyValue
              k="Số khách"
              v={`${booking.adultCount} người lớn · ${booking.childCount} trẻ em`}
            />
            <KeyValue k="Loại phòng" v={roomTypes.join(', ') || '—'} />
            <KeyValue k="Phòng" v={roomNumbers.join(', ') || '—'} />
            <KeyValue k="Ngày đặt" v={fdate(booking.createdAt)} />
          </div>
        </Panel>

        <div className="grid h-fit gap-6">
          <Panel title="Hoá đơn">
            <div className="divide-y">
              <KeyValue
                k={`Tiền phòng · ${nights} đêm`}
                v={<span className="tabular-nums">{vnd(booking.roomTotal)}</span>}
              />
              {totals && (
                <>
                  <KeyValue
                    k="Dịch vụ"
                    v={<span className="tabular-nums">{vnd(totals.serviceTotal)}</span>}
                  />
                  {totals.additionalTotal > 0 && (
                    <KeyValue
                      k="Phụ phí"
                      v={<span className="tabular-nums">{vnd(totals.additionalTotal)}</span>}
                    />
                  )}
                  <KeyValue
                    k="Tiền cọc"
                    v={<span className="tabular-nums">{vnd(totals.depositPaid)}</span>}
                  />
                  <KeyValue
                    k="Đã thanh toán"
                    v={<span className="tabular-nums">{vnd(paid)}</span>}
                  />
                  <KeyValue
                    k="Còn lại"
                    v={
                      <span
                        className={cn(
                          'tabular-nums',
                          totals.balanceDue > 0 ? 'text-primary' : 'text-success',
                        )}
                      >
                        {vnd(Math.max(0, totals.balanceDue))}
                      </span>
                    }
                  />
                </>
              )}
            </div>
          </Panel>

          <Panel title="Khách">
            <div className="divide-y">
              <KeyValue k="Tên" v={booking.guestName || '—'} />
              <KeyValue k="Email" v={booking.guestEmail || '—'} />
              <KeyValue k="Điện thoại" v={booking.guestPhone || '—'} />
            </div>
          </Panel>
        </div>
      </div>
    </div>
  )
}
