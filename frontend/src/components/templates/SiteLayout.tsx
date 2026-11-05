import { Menu, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router'
import { cn } from '@/lib/utils'
import { Logo } from '../atoms'
import { isNavActive } from './nav'

export interface SiteLink {
  to: string
  label: string
}

export function SiteLayout({
  children,
  overlay,
  links,
  actions,
}: {
  children: ReactNode
  overlay?: boolean
  links: SiteLink[]
  actions?: ReactNode
}) {
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  return (
    <div className="min-h-screen bg-background">
      <header
        className={cn(
          'z-40 w-full',
          overlay
            ? 'absolute inset-x-0 top-0'
            : 'sticky top-0 border-b bg-background/85 backdrop-blur',
        )}
      >
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 lg:px-8">
          <Logo light={overlay} />
          <nav
            className={cn(
              'hidden items-center gap-1 rounded-full p-1 md:flex',
              overlay ? 'bg-ink/25 backdrop-blur' : 'bg-surface',
            )}
          >
            {links.map((l) => {
              const active = l.to === '/' ? pathname === '/' : isNavActive(pathname, l.to)
              return (
                <Link
                  key={l.to}
                  to={l.to}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'rounded-full px-3 py-2 text-sm whitespace-nowrap transition-colors lg:px-4',
                    overlay
                      ? 'text-ink-foreground/85 hover:text-ink-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                    active &&
                      (overlay
                        ? 'bg-card/20 text-ink-foreground'
                        : 'bg-card text-foreground shadow-sm'),
                  )}
                >
                  {l.label}
                </Link>
              )
            })}
          </nav>
          <div className="hidden items-center gap-2 md:flex">{actions}</div>
          <button
            type="button"
            className={cn('md:hidden', overlay && 'text-ink-foreground')}
            onClick={() => setOpen(!open)}
            aria-label="Mở menu"
            aria-expanded={open}
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
        {open && (
          <div className="mx-4 mb-4 rounded-2xl border bg-card p-3 shadow-lg md:hidden">
            {links.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                className="block rounded-lg px-3 py-2.5 text-sm hover:bg-surface"
              >
                {l.label}
              </Link>
            ))}
            {actions && <div className="mt-2 flex flex-col gap-2 border-t pt-3">{actions}</div>}
          </div>
        )}
      </header>
      <main>{children}</main>
      <footer className="mt-24 bg-ink text-ink-foreground">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 md:grid-cols-4 lg:px-8">
          <div className="md:col-span-2">
            <Logo light />
            <p className="font-display mt-4 max-w-sm text-3xl leading-tight">
              Sang trọng tĩnh lặng bên vịnh biển.
            </p>
          </div>
          <div className="text-sm">
            <div className="mb-3 text-ink-foreground/50">Lưu trú</div>
            <div className="grid gap-2">
              {links
                .filter((l) => l.to !== '/')
                .map((l) => (
                  <Link key={l.to} to={l.to}>
                    {l.label}
                  </Link>
                ))}
            </div>
          </div>
          <div className="text-sm">
            <div className="mb-3 text-ink-foreground/50">Liên hệ</div>
            <div className="grid gap-2 text-ink-foreground/80">
              <span>12 Trần Phú, Nha Trang</span>
              <span>+84 258 000 1234</span>
              <span>stay@emilyhotel.vn</span>
            </div>
          </div>
        </div>
        <div className="border-t border-ink-foreground/10 py-5 text-center text-xs text-ink-foreground/50">
          © 2026 Emily Hotel
        </div>
      </footer>
    </div>
  )
}
