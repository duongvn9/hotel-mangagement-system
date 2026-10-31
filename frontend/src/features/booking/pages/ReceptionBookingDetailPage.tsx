import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { Alert } from '@/components/Alert'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { getErrorMessage } from '@/lib/api-client'
import { BOOKING_STATUS_DISPLAY, type BookingListItem } from '../api'
import { useBookingList } from '../hooks'
import { formatDate, money, nightsBetween } from '../utils'

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

  let body: ReactNode
  if (list.isPending) {
    body = <p className="text-stone-700">Đang tải…</p>
  } else if (list.isError) {
    body = <Alert tone="danger">{getErrorMessage(list.error)}</Alert>
  } else if (!booking) {
    body = <Alert tone="warning">Không tìm thấy booking này.</Alert>
  } else {
    body = <ReceptionBookingDetail booking={booking} />
  }

  return (
    <section className="mx-auto max-w-container space-y-6 px-4 py-10 font-body">
      <div>
        <p className="text-xs font-semibold tracking-widest text-primary uppercase">Lễ tân</p>
        <h1 className="font-display text-4xl font-semibold text-pearl-900">Chi tiết booking {code}</h1>
      </div>
      {body}
      <Link
        to="/reception/bookings"
        className="inline-flex h-11 items-center text-sm font-semibold tracking-wider text-stone-700 uppercase hover:text-primary"
      >
        ← Danh sách booking
      </Link>
    </section>
  )
}

function ReceptionBookingDetail({ booking }: { booking: BookingListItem }) {
  const status = BOOKING_STATUS_DISPLAY[booking.status] ?? {
    label: booking.status,
    tone: 'neutral' as const,
  }
  const nights = nightsBetween(booking.checkIn, booking.checkOut)
  const rooms = booking.rooms
    .map((room) => [room.roomNumber, room.roomTypeName].filter(Boolean).join(' · '))
    .filter(Boolean)
  const editable = EDITABLE_STATUSES.includes(booking.status)

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <div className="space-y-4 rounded-xl border border-stone-300 bg-white p-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-2xl font-semibold tracking-wide text-primary">{booking.code}</span>
            <Badge tone={status.tone}>{status.label}</Badge>
            {booking.source === 'FRONT_DESK' && <Badge tone="info">Tại quầy</Badge>}
          </div>
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <Field label="Khách">{booking.guestName || '—'}</Field>
            <Field label="Nguồn đặt">
              {booking.source === 'FRONT_DESK' ? 'Tại quầy (lễ tân)' : 'Online'}
            </Field>
            <Field label="Email">{booking.guestEmail || '—'}</Field>
            <Field label="Số điện thoại">{booking.guestPhone || '—'}</Field>
            <Field label="Nhận phòng">{formatDate(booking.checkIn)}</Field>
            <Field label="Trả phòng">{formatDate(booking.checkOut)}</Field>
            <Field label="Số đêm">{nights} đêm</Field>
            <Field label="Số khách">
              {booking.adultCount} người lớn · {booking.childCount} trẻ em
            </Field>
          </dl>
        </div>

        <div className="space-y-3 rounded-xl border border-stone-300 bg-white p-6">
          <h2 className="font-display text-xl font-semibold text-pearl-900">Phòng ({rooms.length})</h2>
          {rooms.length === 0 ? (
            <p className="text-sm text-stone-700">Chưa gán phòng cho booking này.</p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {rooms.map((label, index) => (
                <li key={index} className="rounded border border-stone-300 px-4 py-3 text-sm">
                  {label}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <aside className="h-fit space-y-4 rounded-xl border border-stone-300 bg-cream-50 p-6 lg:sticky lg:top-6">
        <h2 className="font-display text-xl font-semibold text-pearl-900">Thanh toán</h2>
        <dl className="space-y-2 border-y border-stone-300 py-4 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-stone-700">Tiền phòng</dt>
            <dd className="font-semibold tabular-nums">{money.format(booking.roomTotal)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-stone-700">Ngày tạo</dt>
            <dd className="font-semibold">{formatDate(booking.createdAt)}</dd>
          </div>
        </dl>
        {editable ? (
          <Link to={`/reception/bookings/${encodeURIComponent(booking.code)}/edit`} className="block">
            <Button className="w-full">Sửa booking</Button>
          </Link>
        ) : (
          <p className="text-xs text-stone-700">
            Booking ở trạng thái này không còn sửa được.
          </p>
        )}
      </aside>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-stone-700">{label}</dt>
      <dd className="font-semibold text-pearl-900">{children}</dd>
    </div>
  )
}
