import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { TextField } from '@/components/TextField'
import { BOOKING_STATUS_DISPLAY } from '../api'
import { listStoredBookings } from '../storage'
import { formatDate, money } from '../utils'

/**
 * UC09/UC10 (đọc lại ở client) — danh sách booking đã tạo trên thiết bị này.
 * Backend chưa có GET nên đây là tiện ích per-viewer; kèm ô tra cứu bằng mã để mở lại booking cũ.
 */
export function MyBookingsPage() {
  const navigate = useNavigate()
  const bookings = listStoredBookings()
  const [lookupId, setLookupId] = useState('')
  const [lookupCode, setLookupCode] = useState('')

  function openLookup(event: FormEvent) {
    event.preventDefault()
    const id = lookupId.trim()
    if (!id) return
    const code = lookupCode.trim()
    navigate(`/booking/${id}${code ? `?code=${encodeURIComponent(code)}` : ''}`)
  }

  return (
    <section className="mx-auto max-w-container space-y-8 px-4 py-10 font-body">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-widest text-primary uppercase">Đặt phòng</p>
          <h1 className="font-display text-4xl font-semibold text-pearl-900">Đặt phòng của tôi</h1>
        </div>
        <Link to="/search">
          <Button>Tìm phòng mới</Button>
        </Link>
      </div>

      {bookings.length === 0 ? (
        <p className="rounded-lg border border-stone-300 bg-white p-6 text-stone-700">
          Chưa có booking nào trên thiết bị này. Hãy tìm phòng để bắt đầu, hoặc tra cứu bằng mã bên
          dưới.
        </p>
      ) : (
        <ul className="space-y-3">
          {bookings.map((booking) => {
            const display = BOOKING_STATUS_DISPLAY[booking.status] ?? {
              label: booking.status,
              tone: 'neutral' as const,
            }
            return (
              <li key={booking.id}>
                <Link
                  to={`/booking/${booking.id}`}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-stone-300 bg-white p-5 hover:bg-cream-50"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-semibold tracking-wide text-pearl-900">
                        {booking.code}
                      </span>
                      <Badge tone={display.tone}>{display.label}</Badge>
                    </div>
                    <p className="text-sm text-stone-700">
                      {formatDate(booking.checkIn)} → {formatDate(booking.checkOut)} ·{' '}
                      {booking.rooms.length} phòng · {booking.guests} khách
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs tracking-wider text-stone-700 uppercase">Tiền cọc</p>
                    <p className="font-semibold text-primary tabular-nums">
                      {money.format(booking.depositAmount)}
                    </p>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      <form
        onSubmit={openLookup}
        className="space-y-4 rounded-lg border border-stone-300 bg-white p-6"
        aria-label="Tra cứu booking bằng mã"
      >
        <h2 className="font-display text-xl font-semibold text-pearl-900">Tra cứu booking</h2>
        <p className="text-sm text-stone-700">
          Dùng khi mở lại booking từ thiết bị khác. Nhập mã booking (vé) đã nhận cùng mã định danh
          booking để đặt cọc hoặc huỷ.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <TextField
            label="Mã định danh booking (ID)"
            placeholder="vd: 6716..."
            value={lookupId}
            onChange={(event) => setLookupId(event.target.value)}
          />
          <TextField
            label="Mã booking (vé)"
            placeholder="BK..."
            value={lookupCode}
            onChange={(event) => setLookupCode(event.target.value)}
          />
        </div>
        <Button type="submit">Mở booking</Button>
      </form>
    </section>
  )
}
