import { Link, useParams } from 'react-router'
import { Button, StatusBadge } from '@/components/atoms'
import { EmptyState, KeyValue } from '@/components/molecules'
import { Panel } from '@/components/organisms'
import { getErrorMessage } from '@/lib/api-client'
import { fdate, vnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { BookingListItem, InvoiceTotals } from '../api'
import { useBookingCharges, useBookingList } from '../hooks'
import { nightsBetween } from '../utils'

/** Trạng thái còn sửa được (UC11): trước khi nhận phòng và chưa huỷ. */
const EDITABLE_STATUSES = ['PENDING_DEPOSIT', 'CONFIRMED']

/** Nhãn tiếng Việt và tông màu cho trạng thái hoá đơn. */
const INVOICE_STATUS: Record<string, { label: string; tone: string }> = {
  PAID: { label: 'Đã thanh toán đủ', tone: 'text-success' },
  PARTIALLY_PAID: { label: 'Thanh toán một phần', tone: 'text-warning' },
  UNPAID: { label: 'Chưa thanh toán', tone: 'text-muted-foreground' },
}

/**
 * UC09 — View Booking Detail (bản cho Lễ tân/Quản lý). Xem toàn bộ thông tin một booking tại quầy:
 * khách, lưu trú, phòng, tiền phòng, nguồn đặt. Chưa có API đọc chi tiết theo mã nên dùng lại
 * danh sách (UC10) lọc theo mã, giống trang Sửa booking.
 */
export function ReceptionBookingDetailPage() {
  const { code = '' } = useParams()
  const list = useBookingList({ page: 1, limit: 20, q: code })
  const booking = list.data?.items.find((entry) => entry.code === code)

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-5 py-10 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="mb-2 text-xs font-semibold tracking-widest text-primary uppercase">
            Lễ tân
          </p>
          <h1 className="font-display text-4xl font-semibold break-words lining-nums">
            Chi tiết booking {code}
          </h1>
          {booking && (
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <StatusBadge status={booking.status} />
              <span className="text-sm text-muted-foreground">
                {booking.source === 'FRONT_DESK' ? 'Đặt tại quầy' : 'Đặt online'}
              </span>
            </div>
          )}
        </div>
        <Link
          to="/reception/bookings"
          className="text-sm text-muted-foreground transition hover:text-foreground"
        >
          ← Danh sách booking
        </Link>
      </div>

      {list.isPending && (
        <div role="status" className="py-8">
          <p className="text-muted-foreground">Đang tải…</p>
        </div>
      )}

      {list.isError && (
        <div
          role="alert"
          className="rounded-xl border border-destructive/20 bg-destructive/10 p-5 text-destructive"
        >
          {getErrorMessage(list.error)}
        </div>
      )}

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
    </div>
  )
}

function ReceptionBookingDetail({ booking }: { booking: BookingListItem }) {
  const nights = nightsBetween(booking.checkIn, booking.checkOut)
  const rooms = booking.rooms
    .map((room) => [room.roomNumber, room.roomTypeName].filter(Boolean).join(' · '))
    .filter(Boolean)
  const editable = EDITABLE_STATUSES.includes(booking.status)

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        <Panel title="Lưu trú">
          <div className="grid gap-x-8 sm:grid-cols-2">
            <KeyValue k="Nhận phòng" v={fdate(booking.checkIn)} />
            <KeyValue k="Trả phòng" v={fdate(booking.checkOut)} />
            <KeyValue k="Số đêm" v={`${nights} đêm`} />
            <KeyValue
              k="Số khách"
              v={`${booking.adultCount} người lớn · ${booking.childCount} trẻ em`}
            />
            <KeyValue
              k="Nguồn đặt"
              v={booking.source === 'FRONT_DESK' ? 'Tại quầy (lễ tân)' : 'Online'}
            />
          </div>
        </Panel>

        <Panel title="Khách">
          <div className="grid gap-x-8 sm:grid-cols-2">
            <KeyValue k="Họ tên" v={booking.guestName || '—'} />
            <KeyValue k="Email" v={booking.guestEmail || '—'} />
            <KeyValue k="Số điện thoại" v={booking.guestPhone || '—'} />
          </div>
        </Panel>

        <Panel title={`Phòng (${rooms.length})`}>
          {rooms.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chưa gán phòng cho booking này.</p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {rooms.map((label, index) => (
                <li key={index} className="rounded-lg border px-4 py-3 text-sm">
                  {label}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="space-y-6">
        <InvoicePanel booking={booking} />

        {editable ? (
          <Button asChild className="w-full rounded-full">
            <Link to={`/reception/bookings/${encodeURIComponent(booking.code)}/edit`}>
              Sửa booking
            </Link>
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground">
            Booking ở trạng thái này không còn sửa được.
          </p>
        )}
      </div>
    </div>
  )
}

/**
 * Hoá đơn đầy đủ của booking (H7): tiền phòng, dịch vụ, phụ phí, đã cọc/đã trả và số còn
 * phải thu. Đọc từ GET /bookings/:id/charges (lễ tân/quản lý).
 */
function InvoicePanel({ booking }: { booking: BookingListItem }) {
  const charges = useBookingCharges(booking.id)

  return (
    <Panel title="Hoá đơn">
      {charges.isPending && <p className="text-sm text-muted-foreground">Đang tải hoá đơn…</p>}
      {charges.isError && (
        <p role="alert" className="text-sm text-danger">
          {getErrorMessage(charges.error, 'Không đọc được hoá đơn.')}
        </p>
      )}
      {charges.data && (
        <>
          <InvoiceBreakdown totals={charges.data.totals} status={charges.data.invoiceStatus} />
          <div className="mt-2 border-t border-border pt-2">
            <KeyValue k="Ngày tạo" v={fdate(booking.createdAt)} />
          </div>
        </>
      )}
    </Panel>
  )
}

/** Bảng chi tiết các khoản của một hoá đơn; ẩn các dòng bằng 0 để gọn. */
function InvoiceBreakdown({ totals, status }: { totals: InvoiceTotals; status: string }) {
  const money = (amount: number) => <span className="tabular-nums">{vnd(amount)}</span>
  const invoiceStatus = INVOICE_STATUS[status]
  return (
    <div className="divide-y">
      <KeyValue k="Tiền phòng" v={money(totals.roomTotal)} />
      {totals.serviceTotal > 0 && <KeyValue k="Dịch vụ" v={money(totals.serviceTotal)} />}
      {totals.additionalTotal > 0 && <KeyValue k="Phụ phí" v={money(totals.additionalTotal)} />}
      {totals.discountTotal > 0 && (
        <KeyValue
          k="Giảm giá"
          v={<span className="tabular-nums text-success">− {vnd(totals.discountTotal)}</span>}
        />
      )}
      {totals.taxTotal > 0 && <KeyValue k="Thuế" v={money(totals.taxTotal)} />}
      <KeyValue
        k="Tổng cộng"
        v={<span className="font-semibold tabular-nums">{vnd(totals.totalAmount)}</span>}
      />
      <KeyValue k="Đã cọc" v={money(totals.depositPaid)} />
      {totals.finalPaid > 0 && <KeyValue k="Đã thanh toán thêm" v={money(totals.finalPaid)} />}
      <KeyValue
        k="Còn phải trả"
        v={
          <span
            className={cn(
              'font-semibold tabular-nums',
              totals.balanceDue > 0 ? 'text-warning' : 'text-success',
            )}
          >
            {vnd(totals.balanceDue)}
          </span>
        }
      />
      <KeyValue
        k="Trạng thái hoá đơn"
        v={
          <span className={cn('font-medium', invoiceStatus?.tone ?? 'text-muted-foreground')}>
            {invoiceStatus?.label ?? status}
          </span>
        }
      />
    </div>
  )
}
