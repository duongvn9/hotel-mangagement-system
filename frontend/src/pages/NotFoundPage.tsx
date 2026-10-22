import { Link } from 'react-router'

export function NotFoundPage() {
  return (
    <section className="mx-auto max-w-container px-4 py-24 text-center">
      <h1 className="font-display text-5xl font-semibold">404</h1>
      <p className="mt-4 text-stone-700">Không tìm thấy trang bạn yêu cầu.</p>
      <Link
        to="/"
        className="mt-8 inline-flex h-11 items-center rounded bg-primary px-6 text-sm font-semibold tracking-wider text-white uppercase hover:bg-primary-hover"
      >
        Về trang chủ
      </Link>
    </section>
  )
}
