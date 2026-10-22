import { ApiStatus } from '@/components/ApiStatus'

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
        Khung dự án đã sẵn sàng. Trang chủ thật sẽ được làm trong task “Layout chung, routing theo
        role, Home Page”.
      </p>
      <div className="mt-10">
        <ApiStatus />
      </div>
    </section>
  )
}
