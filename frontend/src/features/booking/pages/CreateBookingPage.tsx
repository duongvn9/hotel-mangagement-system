import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Alert } from '@/components/Alert'
import { Button } from '@/components/Button'
import { TextField } from '@/components/TextField'
import { getErrorMessage } from '@/lib/api-client'
import { useAuth } from '@/features/auth/auth-context'
import type { AvailableRoom } from '../api'
import { useAvailability, useCreateBooking } from '../hooks'
import { BedIcon, MoonIcon } from '../icons'
import { upsertStoredBooking } from '../storage'
import { formatDate, money, nightsBetween } from '../utils'

/** Tỉ lệ cọc để ước tính hiển thị; con số chính thức do server tính khi tạo booking. */
const DEPOSIT_RATE = 0.3

interface SummaryLine {
  name: string
  pricePerNight: number
  qty: number
}

/** Gom các phòng đã chọn theo loại để hiện bảng tạm tính (giá lấy từ UC05 công khai). */
function buildSummary(available: AvailableRoom[] | undefined, rooms: string[], nights: number) {
  const byId = new Map((available ?? []).map((room) => [room.id, room]))
  const lines = new Map<string, SummaryLine>()
  let matched = 0
  for (const id of rooms) {
    const room = byId.get(id)
    if (!room) continue
    matched += 1
    const previous = lines.get(room.roomTypeId)
    lines.set(room.roomTypeId, {
      name: room.roomTypeName ?? 'Phòng',
      pricePerNight: room.pricePerNight ?? 0,
      qty: (previous?.qty ?? 0) + 1,
    })
  }
  const items = [...lines.values()]
  const roomTotal = items.reduce((sum, line) => sum + line.qty * line.pricePerNight * nights, 0)
  return {
    items,
    roomTotal,
    deposit: Math.round(roomTotal * DEPOSIT_RATE),
    // Chỉ chắc chắn khi khớp đủ giá cho mọi phòng đã chọn.
    complete: matched === rooms.length && items.length > 0,
  }
}

/** UC07/UC46 — Create Booking. Khách điền thông tin liên hệ rồi tạo booking (giữ phòng 15 phút). */
export function CreateBookingPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { me } = useAuth()
  const create = useCreateBooking()

  const checkIn = params.get('checkIn') ?? ''
  const checkOut = params.get('checkOut') ?? ''
  const guests = Number(params.get('guests') ?? '0')
  const roomsParam = params.get('rooms') ?? ''
  const rooms = roomsParam.split(',').filter(Boolean)
  const nights = nightsBetween(checkIn, checkOut)
  const invalid = rooms.length === 0 || nights <= 0 || guests < 1

  const [guestName, setGuestName] = useState(me?.fullName ?? '')
  const [guestEmail, setGuestEmail] = useState(me?.email ?? '')
  const [guestPhone, setGuestPhone] = useState(me?.phone ?? '')
  // Mặc định coi số khách đã tìm là người lớn; khách có thể tách trẻ em.
  const [adultCount, setAdultCount] = useState(Math.max(1, guests))
  const [childCount, setChildCount] = useState(0)
  const occupancy = adultCount + childCount

  // Lấy lại giá các phòng đã chọn từ endpoint công khai để hiện bảng tạm tính.
  const availability = useAvailability(invalid ? null : { checkIn, checkOut, guests })
  const summary = buildSummary(availability.data, rooms, nights)

  if (invalid) {
    return (
      <section className="mx-auto max-w-container space-y-4 px-4 py-16 text-center font-body">
        <h1 className="font-display text-3xl font-semibold text-pearl-900">
          Thiếu thông tin đặt phòng
        </h1>
        <p className="text-stone-700">Vui lòng chọn lại phòng và ngày ở.</p>
        <Link to="/search" className="text-primary underline">
          Quay lại tìm phòng
        </Link>
      </section>
    )
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    try {
      const booking = await create.mutateAsync({
        rooms,
        checkIn,
        checkOut,
        adultCount,
        childCount,
        guestName: guestName.trim(),
        guestEmail: guestEmail.trim(),
        guestPhone: guestPhone.trim(),
      })
      upsertStoredBooking(booking)
      navigate(`/booking/${booking.id}`, { replace: true })
    } catch {
      // Lỗi hiển thị qua create.isError bên dưới.
    }
  }

  return (
    <section className="mx-auto max-w-container space-y-6 px-4 py-10 font-body">
      <div>
        <p className="text-xs font-semibold tracking-widest text-primary uppercase">Đặt phòng</p>
        <h1 className="font-display text-4xl font-semibold text-pearl-900">
          Xác nhận & thông tin liên hệ
        </h1>
      </div>

      <form onSubmit={submit} className="grid items-start gap-6 lg:grid-cols-[1fr_360px]">
        {/* Cột trái: thông tin khách */}
        <div className="space-y-5">
          <div className="space-y-4 rounded-xl border border-stone-300 bg-white p-6">
            <h2 className="font-display text-xl font-semibold text-pearl-900">Thông tin liên hệ</h2>
            {me && (
              <p className="text-sm text-stone-700">
                Đặt với tài khoản {me.email}. Bạn có thể sửa tên và số điện thoại nếu cần.
              </p>
            )}
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
            <p className="text-xs text-stone-700">
              Chúng tôi gửi mã đặt phòng (vé) tới email/số điện thoại này để bạn thanh toán và quản
              lý đơn.
            </p>
          </div>

          <div className="space-y-4 rounded-xl border border-stone-300 bg-white p-6">
            <h2 className="font-display text-xl font-semibold text-pearl-900">Số khách</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Người lớn"
                type="number"
                min={1}
                max={20}
                required
                value={String(adultCount)}
                onChange={(event) => setAdultCount(Math.max(1, Number(event.target.value) || 1))}
              />
              <TextField
                label="Trẻ em"
                type="number"
                min={0}
                max={20}
                value={String(childCount)}
                onChange={(event) => setChildCount(Math.max(0, Number(event.target.value) || 0))}
              />
            </div>
          </div>

          {create.isError && <Alert tone="danger">{getErrorMessage(create.error)}</Alert>}

          <Link
            to="/search"
            className="inline-flex h-11 items-center text-sm font-semibold tracking-wider text-stone-700 uppercase hover:text-primary"
          >
            ← Chọn lại phòng
          </Link>
        </div>

        {/* Cột phải: tóm tắt đặt phòng (sticky) */}
        <aside className="h-fit space-y-4 rounded-xl border border-stone-300 bg-cream-50 p-6 lg:sticky lg:top-6">
          <h2 className="font-display text-xl font-semibold text-pearl-900">Tóm tắt đặt phòng</h2>

          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-stone-700">Nhận phòng</dt>
              <dd className="font-semibold">{formatDate(checkIn)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-stone-700">Trả phòng</dt>
              <dd className="font-semibold">{formatDate(checkOut)}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="inline-flex items-center gap-1.5 text-stone-700">
                <MoonIcon className="size-4 text-primary" /> Số đêm
              </dt>
              <dd className="font-semibold">{nights}</dd>
            </div>
          </dl>

          <div className="space-y-2 border-t border-stone-300 pt-4 text-sm">
            {summary.items.length === 0 ? (
              <p className="inline-flex items-center gap-1.5 text-stone-700">
                <BedIcon className="size-4 text-primary" /> {rooms.length} phòng · {occupancy} khách
              </p>
            ) : (
              summary.items.map((line) => (
                <div key={line.name} className="flex justify-between gap-4">
                  <span className="text-stone-700">
                    {line.name} × {line.qty}
                    <span className="block text-xs text-stone-500">
                      {money.format(line.pricePerNight)}/đêm × {nights} đêm
                    </span>
                  </span>
                  <span className="font-semibold tabular-nums">
                    {money.format(line.qty * line.pricePerNight * nights)}
                  </span>
                </div>
              ))
            )}
          </div>

          {summary.items.length > 0 && (
            <dl className="space-y-2 border-t border-stone-300 pt-4 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-stone-700">Tạm tính tiền phòng</dt>
                <dd className="font-semibold tabular-nums">{money.format(summary.roomTotal)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="font-semibold text-pearl-900">
                  Cọc cần trả ({DEPOSIT_RATE * 100}%)
                </dt>
                <dd className="font-display text-lg font-semibold text-primary tabular-nums">
                  {money.format(summary.deposit)}
                </dd>
              </div>
            </dl>
          )}

          <p className="text-xs text-stone-700">
            {summary.complete
              ? 'Số tiền trên là tạm tính. Tổng tiền và tiền cọc chính thức được hệ thống xác nhận khi tạo đơn. Bạn chưa bị trừ tiền ở bước này.'
              : 'Hệ thống sẽ tính và xác nhận tổng tiền, tiền cọc khi tạo đơn. Bạn chưa bị trừ tiền ở bước này.'}
          </p>

          <Button type="submit" className="w-full" loading={create.isPending}>
            Tạo booking & đặt cọc
          </Button>
          <p className="text-center text-xs text-stone-700">
            Phòng được giữ 15 phút để bạn đặt cọc.
          </p>
        </aside>
      </form>
    </section>
  )
}
