import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Alert } from '@/components/Alert'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { TextField } from '@/components/TextField'
import { getErrorMessage } from '@/lib/api-client'
import { BOOKING_STATUS_DISPLAY, type BookingListItem } from '../api'
import { useAvailability, useBookingList, useUpdateBooking } from '../hooks'
import { money, nightsBetween, toBusinessDate } from '../utils'

/** Trạng thái còn sửa được (UC11): trước khi nhận phòng và chưa huỷ. */
const EDITABLE_STATUSES = ['PENDING_DEPOSIT', 'CONFIRMED']

/** UC11 — Update Booking. Lễ tân/Quản lý sửa ngày, phòng, số khách và thông tin liên hệ. */
export function EditBookingPage() {
  const { code = '' } = useParams()
  // Chưa có API đọc chi tiết (UC09), nên tìm booking theo mã bằng danh sách UC10.
  const list = useBookingList({ page: 1, limit: 20, q: code })
  const booking = list.data?.items.find((entry) => entry.code === code)

  let body
  if (list.isPending) {
    body = <p className="text-stone-700">Đang tải…</p>
  } else if (list.isError) {
    body = <Alert tone="danger">{getErrorMessage(list.error)}</Alert>
  } else if (!booking) {
    body = <Alert tone="warning">Không tìm thấy booking này.</Alert>
  } else if (!EDITABLE_STATUSES.includes(booking.status)) {
    body = (
      <Alert tone="warning">
        Booking {booking.code} ở trạng thái{' '}
        {BOOKING_STATUS_DISPLAY[booking.status]?.label ?? booking.status} nên không thể sửa.
      </Alert>
    )
  } else {
    body = <EditBookingForm booking={booking} />
  }

  return (
    <section className="mx-auto max-w-container space-y-6 px-4 py-10 font-body">
      <div>
        <p className="text-xs font-semibold tracking-widest text-primary uppercase">Lễ tân</p>
        <h1 className="font-display text-4xl font-semibold text-pearl-900">Sửa booking {code}</h1>
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

function EditBookingForm({ booking }: { booking: BookingListItem }) {
  const navigate = useNavigate()
  const update = useUpdateBooking()

  const [checkIn, setCheckIn] = useState(toBusinessDate(booking.checkIn))
  const [checkOut, setCheckOut] = useState(toBusinessDate(booking.checkOut))
  const [adultCount, setAdultCount] = useState(String(booking.adultCount))
  const [childCount, setChildCount] = useState(String(booking.childCount))
  const [guestName, setGuestName] = useState(booking.guestName ?? '')
  const [guestEmail, setGuestEmail] = useState(booking.guestEmail ?? '')
  const [guestPhone, setGuestPhone] = useState(booking.guestPhone ?? '')
  const [selected, setSelected] = useState(booking.rooms.map((room) => room.id))

  const nights = nightsBetween(checkIn, checkOut)
  const adults = Number(adultCount)
  const children = Number(childCount)
  const criteria =
    nights > 0 &&
    Number.isInteger(adults) &&
    adults >= 1 &&
    Number.isInteger(children) &&
    children >= 0
      ? { checkIn, checkOut, adultCount: adults, childCount: children }
      : null
  const availability = useAvailability(
    criteria ? { checkIn, checkOut, guests: criteria.adultCount + criteria.childCount } : null,
  )

  // Phòng hiện tại luôn chọn lại được (kết quả tìm phòng loại trừ chính booking đang giữ chúng);
  // server vẫn kiểm tra lại phòng trống khi lưu.
  const options = useMemo(() => {
    const current = booking.rooms.map((room) => ({
      id: room.id,
      label: [room.roomNumber, room.roomTypeName].filter(Boolean).join(' · ') || 'Phòng',
      note: 'Đang đặt',
      pricePerNight: undefined as number | undefined,
    }))
    const currentIds = new Set(current.map((room) => room.id))
    const countByType = new Map<string, number>()
    const others = (availability.data ?? [])
      .filter((room) => !currentIds.has(room.id))
      .map((room) => {
        const index = (countByType.get(room.roomTypeId) ?? 0) + 1
        countByType.set(room.roomTypeId, index)
        return {
          id: room.id,
          label: `${room.roomTypeName ?? 'Phòng'} · Phòng trống ${index}`,
          note: 'Còn trống',
          pricePerNight: room.pricePerNight,
        }
      })
    return [...current, ...others]
  }, [booking.rooms, availability.data])

  function toggle(id: string) {
    setSelected((value) =>
      value.includes(id) ? value.filter((entry) => entry !== id) : [...value, id],
    )
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (selected.length === 0 || !criteria) return
    try {
      await update.mutateAsync({
        id: booking.id,
        input: {
          rooms: selected,
          ...criteria,
          guestName: guestName.trim(),
          guestEmail: guestEmail.trim(),
          guestPhone: guestPhone.trim(),
        },
      })
      navigate('/reception/bookings')
    } catch {
      // Lỗi hiển thị qua update.isError bên dưới.
    }
  }

  const status = BOOKING_STATUS_DISPLAY[booking.status]

  return (
    <form onSubmit={submit} className="grid items-start gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-5">
        <div className="space-y-4 rounded-xl border border-stone-300 bg-white p-6">
          <h2 className="font-display text-xl font-semibold text-pearl-900">Thời gian ở</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Nhận phòng"
              type="date"
              required
              value={checkIn}
              onChange={(event) => setCheckIn(event.target.value)}
            />
            <TextField
              label="Trả phòng"
              type="date"
              required
              min={checkIn || undefined}
              value={checkOut}
              onChange={(event) => setCheckOut(event.target.value)}
            />
            <TextField
              label="Người lớn"
              type="number"
              required
              min={1}
              step={1}
              value={adultCount}
              onChange={(event) => setAdultCount(event.target.value)}
            />
            <TextField
              label="Trẻ em"
              type="number"
              required
              min={0}
              step={1}
              value={childCount}
              onChange={(event) => setChildCount(event.target.value)}
            />
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-stone-300 bg-white p-6">
          <h2 className="font-display text-xl font-semibold text-pearl-900">Phòng</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {options.map((room) => (
              <li key={room.id}>
                <label className="flex cursor-pointer items-center gap-3 rounded border border-stone-300 px-4 py-3 text-sm hover:border-stone-500">
                  <input
                    type="checkbox"
                    checked={selected.includes(room.id)}
                    onChange={() => toggle(room.id)}
                    aria-label={room.label}
                  />
                  <span className="flex-1">
                    {room.label}
                    <span className="block text-xs text-stone-500">{room.note}</span>
                  </span>
                  {room.pricePerNight !== undefined && (
                    <span className="text-stone-700 tabular-nums">
                      {money.format(room.pricePerNight)}/đêm
                    </span>
                  )}
                </label>
              </li>
            ))}
          </ul>
          {availability.isError && (
            <Alert tone="danger">{getErrorMessage(availability.error)}</Alert>
          )}
        </div>

        <div className="space-y-4 rounded-xl border border-stone-300 bg-white p-6">
          <h2 className="font-display text-xl font-semibold text-pearl-900">Thông tin khách</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Họ tên"
              required
              maxLength={120}
              value={guestName}
              onChange={(event) => setGuestName(event.target.value)}
            />
            <TextField
              label="Email"
              type="email"
              required
              maxLength={160}
              value={guestEmail}
              onChange={(event) => setGuestEmail(event.target.value)}
            />
            <TextField
              label="Số điện thoại"
              type="tel"
              required
              value={guestPhone}
              onChange={(event) => setGuestPhone(event.target.value)}
              className="sm:col-span-2"
            />
          </div>
        </div>

        {update.isError && <Alert tone="danger">{getErrorMessage(update.error)}</Alert>}
      </div>

      <aside className="h-fit space-y-4 rounded-xl border border-stone-300 bg-cream-50 p-6 lg:sticky lg:top-6">
        <h2 className="font-display text-xl font-semibold text-pearl-900">Tóm tắt</h2>
        <dl className="space-y-2 text-sm">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-stone-700">Trạng thái</dt>
            <dd>
              <Badge tone={status?.tone ?? 'neutral'}>{status?.label ?? booking.status}</Badge>
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-stone-700">Số đêm</dt>
            <dd className="font-semibold">{nights}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-stone-700">Phòng đã chọn</dt>
            <dd className="font-semibold">{selected.length}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-stone-700">Tiền phòng hiện tại</dt>
            <dd className="font-semibold tabular-nums">{money.format(booking.roomTotal)}</dd>
          </div>
        </dl>
        <p className="text-xs text-stone-700">
          Khi lưu, hệ thống kiểm tra lại phòng trống và tính lại tiền phòng. Tiền cọc đã nhận của
          booking đã xác nhận được giữ nguyên.
        </p>
        <Button
          type="submit"
          className="w-full"
          loading={update.isPending}
          disabled={selected.length === 0 || !criteria}
        >
          Lưu thay đổi
        </Button>
      </aside>
    </form>
  )
}
