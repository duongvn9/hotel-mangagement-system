import { Link } from 'react-router'
import { ApiStatus } from '@/components/ApiStatus'
import { Button } from '@/components/Button'

export function HomePage() {
  return (
    <section className="mx-auto max-w-container px-4 py-24 text-center">
      <p className="text-xs font-semibold tracking-widest text-gold-500 uppercase">
        Hotel Management System
      </p>
      <h1 className="mt-4 font-display text-5xl font-semibold text-pearl-900">
        Nghỉ dưỡng tĩnh lặng giữa thiên nhiên
      </h1>
      <p className="mx-auto mt-6 max-w-xl text-stone-700">
        Đặt phòng trực tuyến chỉ trong vài bước: chọn ngày, chọn phòng và đặt cọc an toàn qua VNPay.
      </p>
      <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
        <Link to="/search">
          <Button>Tìm phòng trống</Button>
        </Link>
        <Link to="/my-bookings">
          <Button variant="secondary">Booking của tôi</Button>
        </Link>
      </div>
      <div className="mt-10">
        <ApiStatus />
      </div>
    </section>
  )
}
