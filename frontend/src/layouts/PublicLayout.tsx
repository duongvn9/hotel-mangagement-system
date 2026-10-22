import { Link, Outlet } from 'react-router'
import { env } from '@/lib/env'

const currentYear = new Date().getFullYear()

export function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-stone-300 bg-cream-50">
        <div className="mx-auto flex h-16 max-w-container items-center justify-between px-4">
          <Link to="/" className="font-display text-2xl font-semibold text-pearl-900">
            {env.appName}
          </Link>
          <nav className="text-sm font-medium tracking-wide text-stone-700 uppercase">
            <Link to="/" className="hover:text-primary">
              Trang chủ
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="bg-pearl-900 py-8 text-center text-sm text-stone-300">
        © {currentYear} {env.appName}
      </footer>
    </div>
  )
}
