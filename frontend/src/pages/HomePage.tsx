import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { isStaffRole, roleHome } from '@/app/navigation'
import { Alert } from '@/components/Alert'
import { ApiStatus } from '@/components/ApiStatus'
import { Button } from '@/components/Button'
import { LakeIllustration } from '@/components/LakeIllustration'
import { TextField } from '@/components/TextField'
import { ROLE_LABELS } from '@/features/auth/api'
import { useAuth } from '@/features/auth/auth-context'
import { nightsBetween, todayISO } from '@/features/booking/utils'
import { env } from '@/lib/env'

const addDays = (day: string, count: number) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + count * 86_400_000).toISOString().slice(0, 10)

const STEPS = [
  {
    title: 'Chọn ngày và phòng',
    text: 'Nhập ngày nhận, ngày trả và số khách để xem các phòng còn trống, rồi chọn một hoặc nhiều phòng.',
  },
  {
    title: 'Đặt cọc qua VNPay',
    text: 'Hệ thống giữ phòng 15 phút để bạn đặt cọc an toàn qua VNPay, không cần chuyển khoản thủ công.',
  },
  {
    title: 'Nhận phòng tại quầy',
    text: 'Mang mã booking đến quầy lễ tân để nhận phòng. Phần còn lại thanh toán khi trả phòng.',
  },
]

const primaryLink =
  'inline-flex h-11 items-center justify-center rounded bg-primary px-6 text-sm font-semibold tracking-wider text-white uppercase transition-colors duration-150 hover:bg-primary-hover motion-reduce:transition-none'
const secondaryLink =
  'inline-flex h-11 items-center justify-center rounded border border-pearl-900 px-6 text-sm font-semibold tracking-wider text-pearl-900 uppercase transition-colors duration-150 hover:bg-pearl-900 hover:text-cream-100 motion-reduce:transition-none'

/** Trang chủ: hero, thanh tìm phòng nổi, các bước đặt phòng và lối vào theo vai trò. */
export function HomePage() {
  const { me } = useAuth()
  const staff = me !== null && isStaffRole(me.role)

  return (
    <>
      {staff && me && (
        <div className="border-b border-stone-300 bg-primary-soft">
          <div className="mx-auto flex max-w-container flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm text-pearl-900">
            <p>Bạn đang đăng nhập với vai trò {ROLE_LABELS[me.role] ?? me.role}.</p>
            <Link
              to={roleHome(me.role)}
              className="inline-flex min-h-11 items-center font-semibold text-primary hover:text-primary-hover"
            >
              Vào khu làm việc <span aria-hidden>→</span>
            </Link>
          </div>
        </div>
      )}

      <section className="bg-pearl-900 text-cream-100">
        <div className="mx-auto grid max-w-container items-center gap-10 px-4 pt-12 pb-28 md:pt-16 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <p className="text-sm font-semibold tracking-widest text-gold-500 uppercase">
              {env.appName}
            </p>
            <h1 className="mt-4 font-display text-5xl font-semibold text-white lg:text-6xl">
              Nghỉ dưỡng tĩnh lặng giữa thiên nhiên
            </h1>
            <p className="mt-6 max-w-xl text-lg text-stone-300">
              Đặt phòng trực tuyến chỉ trong vài bước: chọn ngày, chọn phòng và đặt cọc an toàn qua
              VNPay.
            </p>
          </div>
          <LakeIllustration className="aspect-[6/5] w-full rounded-xl" />
        </div>
      </section>

      <div className="relative z-10 mx-auto -mt-14 max-w-container px-4">
        <BookingBar />
      </div>

      <section className="mx-auto grid max-w-container gap-12 px-4 py-20 lg:grid-cols-[1fr_1.4fr] lg:gap-20">
        <div>
          <h2 className="font-display text-4xl font-semibold text-pearl-900">
            Đặt phòng trong ba bước
          </h2>
          <p className="mt-4 max-w-md text-stone-700">
            Không cần tài khoản để tìm phòng. Đăng nhập khi bạn muốn theo dõi booking và gửi phản
            hồi sau kỳ nghỉ.
          </p>
        </div>
        <ol aria-label="Các bước đặt phòng" className="border-b border-stone-300">
          {STEPS.map((step, index) => (
            <li
              key={step.title}
              className="grid grid-cols-[auto_1fr] gap-6 border-t border-stone-300 py-6"
            >
              <span aria-hidden className="font-display text-5xl font-semibold text-primary">
                {String(index + 1).padStart(2, '0')}
              </span>
              <div>
                <h3 className="font-display text-2xl font-semibold text-pearl-900">{step.title}</h3>
                <p className="mt-2 max-w-prose text-stone-700">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {!staff && (
        <section className="border-t border-stone-300 bg-cream-50">
          <div className="mx-auto flex max-w-container flex-wrap items-center justify-between gap-6 px-4 py-10">
            <h2 className="font-display text-3xl font-semibold text-pearl-900">
              {me ? 'Tiếp tục kỳ nghỉ của bạn' : 'Đã có tài khoản?'}
            </h2>
            <div className="flex flex-wrap gap-3">
              {me ? (
                <>
                  <Link to="/my-bookings" className={primaryLink}>
                    Booking của tôi
                  </Link>
                  <Link to="/my-feedback" className={secondaryLink}>
                    Phản hồi của tôi
                  </Link>
                </>
              ) : (
                <>
                  <Link to="/login" className={primaryLink}>
                    Đăng nhập
                  </Link>
                  <Link to="/register" className={secondaryLink}>
                    Đăng ký
                  </Link>
                </>
              )}
            </div>
          </div>
        </section>
      )}

      {import.meta.env.DEV && (
        <div className="mx-auto max-w-container px-4 pb-10">
          <ApiStatus />
        </div>
      )}
    </>
  )
}

/** Thanh tìm phòng: chuyển sang /search với ngày và số khách đã chọn. */
function BookingBar() {
  const navigate = useNavigate()
  const today = todayISO()
  const [checkIn, setCheckIn] = useState(today)
  const [checkOut, setCheckOut] = useState(addDays(today, 1))
  const [guests, setGuests] = useState('2')
  const [error, setError] = useState('')

  function submit(event: FormEvent) {
    event.preventDefault()
    if (nightsBetween(checkIn, checkOut) <= 0) {
      setError('Ngày trả phòng phải sau ngày nhận phòng.')
      return
    }
    if (!(Number(guests) >= 1)) {
      setError('Số khách phải từ 1 trở lên.')
      return
    }
    setError('')
    const query = new URLSearchParams({ checkIn, checkOut, guests: String(Number(guests)) })
    navigate(`/search?${query.toString()}`)
  }

  return (
    <form
      role="search"
      aria-label="Tìm phòng trống"
      noValidate
      onSubmit={submit}
      className="grid gap-4 rounded-xl bg-white p-5 shadow-lg md:grid-cols-[1fr_1fr_9rem_auto] md:items-end md:p-6"
    >
      <TextField
        label="Nhận phòng"
        type="date"
        required
        min={today}
        value={checkIn}
        onChange={(event) => setCheckIn(event.target.value)}
      />
      <TextField
        label="Trả phòng"
        type="date"
        required
        min={checkIn || today}
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
      <Button type="submit">Tìm phòng</Button>
      {error && (
        <div className="md:col-span-4">
          <Alert tone="danger">{error}</Alert>
        </div>
      )}
    </form>
  )
}
