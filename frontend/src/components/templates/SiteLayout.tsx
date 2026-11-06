import { Menu, X } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router'
import { cn } from '@/lib/utils'
import { Logo } from '../atoms'
import { isNavActive } from './nav'

export interface SiteLink {
  to: string
  label: string
}

const defaultContact = ['12 Trần Phú, Nha Trang', '+84 258 000 1234', 'stay@emilyhotel.vn']

const CURRENT_YEAR = new Date().getFullYear()

export function SiteLayout({
  children,
  overlay,
  brand = 'Emily Hotel',
  links,
  actions,
  navLabel = 'Menu chính',
  footerLinks,
  footerContact = defaultContact,
  footerTagline = 'Sang trọng tĩnh lặng bên vịnh biển.',
}: {
  children: ReactNode
  overlay?: boolean
  brand?: string
  links: SiteLink[]
  actions?: ReactNode
  navLabel?: string
  footerLinks?: SiteLink[]
  footerContact?: string[]
  footerTagline?: string
}) {
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const [prevPathname, setPrevPathname] = useState(pathname)
  const menuButtonRef = useRef<HTMLButtonElement>(null)

  if (prevPathname !== pathname) {
    setPrevPathname(pathname)
    setOpen(false)
  }

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        menuButtonRef.current?.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:shadow-md"
      >
        Bỏ qua điều hướng
      </a>
      <header
        className={cn(
          'z-40 w-full',
          overlay
            ? 'absolute inset-x-0 top-0'
            : 'sticky top-0 border-b bg-background/85 backdrop-blur',
        )}
      >
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between px-5 py-4 md:h-20 md:py-0 lg:px-8">
          <Logo light={overlay} name={brand} />
          <button
            ref={menuButtonRef}
            type="button"
            className={cn('md:hidden', overlay && 'text-ink-foreground')}
            onClick={() => setOpen((prev) => !prev)}
            aria-label="Mở menu"
            aria-expanded={open}
            aria-controls="main-nav"
          >
            {open ? <X /> : <Menu />}
          </button>
          <nav
            id="main-nav"
            aria-label={navLabel}
            className={cn(
              open
                ? 'mt-3 flex w-full flex-col gap-1 rounded-2xl border bg-card p-3 shadow-lg'
                : 'hidden',
              'md:mt-0 md:flex md:w-auto md:flex-row md:items-center md:gap-1 md:rounded-full md:border-0 md:p-1 md:shadow-none',
              overlay ? 'md:bg-ink/25 md:backdrop-blur' : 'md:bg-surface',
            )}
          >
            {links.map((l) => {
              const active = l.to === '/' ? pathname === '/' : isNavActive(pathname, l.to)
              return (
                <Link
                  key={l.to}
                  to={l.to}
                  aria-current={active ? 'page' : undefined}
                  onClick={() => setOpen(false)}
                  className={cn(
                    'rounded-lg px-3 py-2.5 text-sm transition-colors md:rounded-full md:py-2 lg:px-4 whitespace-nowrap',
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
          {actions && (
            <div
              className={cn(
                open ? 'mt-2 flex w-full flex-col gap-2 pt-2 md:mt-0 md:pt-0' : 'hidden',
                'md:flex md:w-auto md:flex-row md:items-center md:gap-2',
              )}
            >
              {actions}
            </div>
          )}
        </div>
      </header>
      <main id="main" tabIndex={-1} className="flex-1">
        {children}
      </main>
      <footer className="bg-ink text-ink-foreground">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 md:grid-cols-4 lg:px-8">
          <div className="md:col-span-2">
            <Logo light name={brand} />
            <p className="font-display mt-4 max-w-sm text-3xl leading-tight">{footerTagline}</p>
          </div>
          {footerLinks && footerLinks.length > 0 && (
            <div className="text-sm">
              <div className="mb-3 text-ink-foreground/50">Lưu trú</div>
              <div className="grid gap-2">
                {footerLinks.map((l) => (
                  <Link key={l.to} to={l.to}>
                    {l.label}
                  </Link>
                ))}
              </div>
            </div>
          )}
          {footerContact && footerContact.length > 0 && (
            <div className="text-sm">
              <div className="mb-3 text-ink-foreground/50">Liên hệ</div>
              <div className="grid gap-2 text-ink-foreground/80">
                {footerContact.map((c, i) => (
                  <span key={i}>{c}</span>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="border-t border-ink-foreground/10 py-5 text-center text-xs text-ink-foreground/50">
          © {CURRENT_YEAR} {brand}
        </div>
      </footer>
    </div>
  )
}
