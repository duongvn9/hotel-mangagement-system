import { Link, useParams } from 'react-router'
import { Button, StatusBadge } from '@/components/atoms'
import { EmptyState, KeyValue } from '@/components/molecules'
import { Panel } from '@/components/organisms'
import { getErrorMessage } from '@/lib/api-client'
import { fdate, vnd } from '@/lib/format'
import type { BookingListItem } from '../api'
import { useBookingList } from '../hooks'
import { nightsBetween } from '../utils'

/** Trạng thái còn sửa được (UC11): trước khi nhận phòng và chưa huỷ. */
const EDITABLE_STATUSES = ['PENDING_DEPOSIT', 'CONFIRMED']

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
          <p className="text-xs font-semibold tracking-widest text-primary uppercase">Lễ tân</p>
          <h1 className="font-display text-4xl font-semibold break-words">
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
        <Panel title="Hoá đơn">
          <div className="divide-y">
            <KeyValue
              k="Tiền phòng"
              v={<span className="tabular-nums">{vnd(booking.roomTotal)}</span>}
            />
            <KeyValue k="Ngày tạo" v={fdate(booking.createdAt)} />
          </div>
        </Panel>

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
