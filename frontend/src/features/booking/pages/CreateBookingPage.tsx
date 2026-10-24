import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Alert } from '@/components/Alert'
import { Button } from '@/components/Button'
import { TextField } from '@/components/TextField'
import { getErrorMessage } from '@/lib/api-client'
import { useAuth } from '@/features/auth/auth-context'
import { useCreateBooking } from '../hooks'
import { upsertStoredBooking } from '../storage'
import { formatDate, nightsBetween } from '../utils'

/** UC07/UC46 — Create Booking. Khách điền thông tin liên hệ rồi tạo booking (giữ phòng 15 phút). */
export function CreateBookingPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { me } = useAuth()
  const create = useCreateBooking()

  const checkIn = params.get('checkIn') ?? ''
  const checkOut = params.get('checkOut') ?? ''
  const guests = Number(params.get('guests') ?? '0')
  const rooms = (params.get('rooms') ?? '').split(',').filter(Boolean)
  const nights = nightsBetween(checkIn, checkOut)

  const [guestName, setGuestName] = useState(me?.fullName ?? '')
  const [guestEmail, setGuestEmail] = useState(me?.email ?? '')
  const [guestPhone, setGuestPhone] = useState(me?.phone ?? '')

  const invalid = rooms.length === 0 || nights <= 0 || guests < 1

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
        guests,
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
          Xác nhận thông tin đặt phòng
        </h1>
      </div>

      <dl className="grid gap-4 rounded-lg border border-stone-300 bg-white p-6 sm:grid-cols-4">
        <div>
          <dt className="text-xs tracking-wider text-stone-700 uppercase">Nhận phòng</dt>
          <dd className="mt-1 font-semibold">{formatDate(checkIn)}</dd>
        </div>
        <div>
          <dt className="text-xs tracking-wider text-stone-700 uppercase">Trả phòng</dt>
          <dd className="mt-1 font-semibold">{formatDate(checkOut)}</dd>
        </div>
        <div>
          <dt className="text-xs tracking-wider text-stone-700 uppercase">Số đêm</dt>
          <dd className="mt-1 font-semibold">{nights}</dd>
        </div>
        <div>
          <dt className="text-xs tracking-wider text-stone-700 uppercase">Phòng · Khách</dt>
          <dd className="mt-1 font-semibold">
            {rooms.length} phòng · {guests} khách
          </dd>
        </div>
      </dl>

      <form onSubmit={submit} className="space-y-4" aria-label="Thông tin khách">
        <h2 className="font-display text-xl font-semibold text-pearl-900">Thông tin liên hệ</h2>
        {me && (
          <p className="text-sm text-stone-700">
            Đặt với tài khoản {me.email}. Bạn có thể sửa tên và số điện thoại nếu cần.
          </p>
        )}
        <div className="grid gap-4 md:grid-cols-3">
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
          />
        </div>

        {create.isError && <Alert tone="danger">{getErrorMessage(create.error)}</Alert>}

        <p className="text-xs text-stone-700">
          Sau khi tạo, phòng được giữ 15 phút để bạn đặt cọc. Quá hạn chưa cọc, phòng sẽ được mở lại
          cho khách khác.
        </p>

        <div className="flex gap-3">
          <Button type="submit" loading={create.isPending}>
            Tạo booking & tiếp tục đặt cọc
          </Button>
          <Link
            to="/search"
            className="inline-flex h-11 items-center px-4 text-sm font-semibold tracking-wider text-stone-700 uppercase hover:text-primary"
          >
            Quay lại
          </Link>
        </div>
      </form>
    </section>
  )
}
