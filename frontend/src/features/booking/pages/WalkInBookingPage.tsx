import { useMemo, useState, type FormEvent } from 'react'
import { Alert } from '@/components/Alert'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { TextField } from '@/components/TextField'
import { getErrorMessage } from '@/lib/api-client'
import { BOOKING_STATUS_DISPLAY, type SearchAvailabilityParams, type WalkInBooking } from '../api'
import { useAvailability, useCreateWalkInBooking } from '../hooks'
import { formatDate, money, nightsBetween, todayISO } from '../utils'

/** UC08 — Create Booking for Guest. Lễ tân chọn phòng trống rồi đặt hộ khách vãng lai, vào thẳng CONFIRMED. */
export function WalkInBookingPage() {
  const [checkIn, setCheckIn] = useState('')
  const [checkOut, setCheckOut] = useState('')
  const [guests, setGuests] = useState('2')
  const [formError, setFormError] = useState('')
  const [criteria, setCriteria] = useState<SearchAvailabilityParams | null>(null)
  const [selected, setSelected] = useState<string[]>([])

  const [guestName, setGuestName] = useState('')
  const [guestEmail, setGuestEmail] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [created, setCreated] = useState<WalkInBooking | null>(null)

  const availability = useAvailability(criteria)
  const create = useCreateWalkInBooking()
  const nights = criteria ? nightsBetween(criteria.checkIn, criteria.checkOut) : 0

  // Đánh số phòng theo thứ tự trong từng loại (kết quả tìm phòng không trả số phòng).
  const rooms = useMemo(() => {
    const countByType = new Map<string, number>()
    return (availability.data ?? []).map((room) => {
      const index = (countByType.get(room.roomTypeId) ?? 0) + 1
      countByType.set(room.roomTypeId, index)
      return { ...room, label: `${room.roomTypeName ?? 'Phòng'} · Phòng ${index}` }
    })
  }, [availability.data])

  const estimatedTotal = rooms
    .filter((room) => selected.includes(room.id))
    .reduce((sum, room) => sum + (room.pricePerNight ?? 0) * nights, 0)

  function submitSearch(event: FormEvent) {
    event.preventDefault()
    setFormError('')
    if (nightsBetween(checkIn, checkOut) <= 0) {
      setFormError('Ngày trả phòng phải sau ngày nhận phòng.')
      return
    }
    if (!(Number(guests) >= 1)) {
      setFormError('Số khách phải từ 1 trở lên.')
      return
    }
    setSelected([])
    create.reset()
    setCriteria({ checkIn, checkOut, guests: Number(guests) })
  }

  function toggle(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    )
  }

  async function submitBooking(event: FormEvent) {
    event.preventDefault()
    if (!criteria || selected.length === 0) return
    try {
      setCreated(
        await create.mutateAsync({
          rooms: selected,
          ...criteria,
          guestName: guestName.trim(),
          guestEmail: guestEmail.trim(),
          guestPhone: guestPhone.trim(),
        }),
      )
    } catch {
      // Lỗi hiển thị qua create.isError bên dưới.
    }
  }

  function startOver() {
    setCreated(null)
    setCriteria(null)
    setSelected([])
    setGuestName('')
    setGuestEmail('')
    setGuestPhone('')
    create.reset()
  }

  if (created) {
    const status = BOOKING_STATUS_DISPLAY[created.status]
    return (
      <section className="mx-auto max-w-container space-y-6 px-4 py-10 font-body">
        <h1 className="font-display text-4xl font-semibold text-pearl-900">Đã tạo booking</h1>
        <div className="space-y-4 rounded-xl border border-stone-300 bg-white p-6">
          <Alert tone="success">Booking đã xác nhận, phòng đã được giữ cho khách.</Alert>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-stone-700">Mã booking</dt>
              <dd className="font-display text-2xl font-semibold text-primary">{created.code}</dd>
            </div>
            <div>
              <dt className="text-stone-700">Trạng thái</dt>
              <dd>
                <Badge tone={status?.tone ?? 'neutral'}>{status?.label ?? created.status}</Badge>
              </dd>
            </div>
            <div>
              <dt className="text-stone-700">Lưu trú</dt>
              <dd className="font-semibold">
                {formatDate(created.checkIn)} – {formatDate(created.checkOut)}
              </dd>
            </div>
            <div>
              <dt className="text-stone-700">Tiền phòng</dt>
              <dd className="font-semibold tabular-nums">{money.format(created.roomTotal)}</dd>
            </div>
          </dl>
        </div>
        <Button onClick={startOver}>Tạo booking khác</Button>
      </section>
    )
  }

  return (
    <section className="mx-auto max-w-container space-y-6 px-4 py-10 font-body">
      <div>
        <p className="text-xs font-semibold tracking-widest text-primary uppercase">Lễ tân</p>
        <h1 className="font-display text-4xl font-semibold text-pearl-900">
          Tạo booking cho khách vãng lai
        </h1>
        <p className="mt-2 text-sm text-stone-700">
          Booking tại quầy được xác nhận ngay, không cần đặt cọc online.
        </p>
      </div>

      <form
        onSubmit={submitSearch}
        className="grid gap-4 rounded-lg border border-stone-300 bg-white p-6 md:grid-cols-4"
        aria-label="Tìm phòng trống"
      >
        <TextField
          label="Nhận phòng"
          type="date"
          required
          min={todayISO()}
          value={checkIn}
          onChange={(event) => setCheckIn(event.target.value)}
        />
        <TextField
          label="Trả phòng"
          type="date"
          required
          min={checkIn || todayISO()}
          value={checkOut}
          onChange={(event) => setCheckOut(event.target.value)}
        />
        <TextField
          label="Số khách"
          type="number"
          required
          min={1}
          value={guests}
          onChange={(event) => setGuests(event.target.value)}
        />
        <div className="flex items-end">
          <Button type="submit" className="w-full" loading={availability.isFetching}>
            Tìm phòng trống
          </Button>
        </div>
        {formError && (
          <div className="md:col-span-4">
            <Alert tone="danger">{formError}</Alert>
          </div>
        )}
      </form>

      {availability.isError && <Alert tone="danger">{getErrorMessage(availability.error)}</Alert>}

      {criteria && availability.isSuccess && (
        <form onSubmit={submitBooking} className="grid items-start gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-5">
            <div className="space-y-3 rounded-xl border border-stone-300 bg-white p-6">
              <h2 className="font-display text-xl font-semibold text-pearl-900">
                Chọn phòng ({nights} đêm · {rooms.length} phòng trống)
              </h2>
              {rooms.length === 0 ? (
                <p className="text-sm text-stone-700">
                  Không còn phòng phù hợp trong khoảng ngày này.
                </p>
              ) : (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {rooms.map((room) => (
                    <li key={room.id}>
                      <label className="flex cursor-pointer items-center gap-3 rounded border border-stone-300 px-4 py-3 text-sm hover:border-stone-500">
                        <input
                          type="checkbox"
                          checked={selected.includes(room.id)}
                          onChange={() => toggle(room.id)}
                          aria-label={room.label}
                        />
                        <span className="flex-1">{room.label}</span>
                        <span className="text-stone-700 tabular-nums">
                          {money.format(room.pricePerNight ?? 0)}/đêm
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
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
                  placeholder="0900000000"
                  value={guestPhone}
                  onChange={(event) => setGuestPhone(event.target.value)}
                  className="sm:col-span-2"
                />
              </div>
            </div>

            {create.isError && <Alert tone="danger">{getErrorMessage(create.error)}</Alert>}
          </div>

          <aside className="h-fit space-y-4 rounded-xl border border-stone-300 bg-cream-50 p-6 lg:sticky lg:top-6">
            <h2 className="font-display text-xl font-semibold text-pearl-900">Tóm tắt</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-stone-700">Phòng đã chọn</dt>
                <dd className="font-semibold">{selected.length}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-stone-700">Tạm tính tiền phòng</dt>
                <dd className="font-semibold tabular-nums">{money.format(estimatedTotal)}</dd>
              </div>
            </dl>
            <p className="text-xs text-stone-700">
              Tổng tiền chính thức do hệ thống tính khi tạo booking.
            </p>
            <Button
              type="submit"
              className="w-full"
              loading={create.isPending}
              disabled={selected.length === 0}
            >
              Tạo booking
            </Button>
          </aside>
        </form>
      )}
    </section>
  )
}
