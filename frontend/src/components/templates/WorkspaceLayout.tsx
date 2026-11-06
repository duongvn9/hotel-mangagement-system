import { Bell, ChevronDown, Globe, LogOut, Menu } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, Outlet, useLocation } from 'react-router'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage, Logo, Skeleton } from '../atoms'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../molecules'
import { Unauthorized } from '../organisms'

import { isNavActive } from './nav'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
}

export interface NavGroup {
  title: string
  items: NavItem[]
}

function SideNav({
  groups,
  brand,
  navLabel,
  emptyNavText,
  publicSiteTo,
  publicSiteLabel,
  onNavigate,
}: {
  groups: NavGroup[]
  brand: string
  navLabel: string
  emptyNavText?: string
  publicSiteTo?: string
  publicSiteLabel: string
  onNavigate: () => void
}) {
  const { pathname } = useLocation()
  // Mặc định mọi nhóm đều mở. Nhóm do người dùng đóng giữ nguyên khi chuyển trang, trừ khi trang mới
  // thuộc chính nhóm đó thì mở ra để thấy mục đang chọn.
  const [closed, setClosed] = useState<Record<string, boolean>>({})
  const [prevPathname, setPrevPathname] = useState(pathname)
  const activeTitle = groups.find((g) => g.items.some((i) => isNavActive(pathname, i.to)))?.title
  if (prevPathname !== pathname) {
    setPrevPathname(pathname)
    if (activeTitle && closed[activeTitle]) setClosed({ ...closed, [activeTitle]: false })
  }
  const isOpen = (title: string) => !closed[title]

  return (
    <nav
      aria-label={navLabel}
      className="no-scrollbar relative flex h-full flex-col gap-2 overflow-x-hidden overflow-y-auto bg-ink px-4 py-6 text-ink-foreground"
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-20 -left-16 size-56 rounded-full bg-primary/30 blur-3xl" />
        <div className="absolute -right-20 -bottom-24 size-56 rounded-full bg-lavender/20 blur-3xl" />
      </div>
      <div className="relative px-2 pb-4 [&_*]:text-ink-foreground!">
        <Logo name={brand} />
      </div>
      {groups.length === 0 && emptyNavText && (
        <p className="px-3 py-2 text-sm text-ink-foreground/50">{emptyNavText}</p>
      )}
      {groups.map((g) => {
        const open = isOpen(g.title)
        const hasActive = g.items.some((i) => isNavActive(pathname, i.to))
        return (
          <div key={g.title} className="relative">
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setClosed({ ...closed, [g.title]: open })}
              className="group/head flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-[10px] font-medium tracking-[0.2em] text-ink-foreground/45 uppercase transition-colors hover:text-ink-foreground/85"
            >
              <span className={cn('transition-colors', hasActive && 'text-primary/90')}>
                {g.title}
              </span>
              <span className="h-px flex-1 bg-ink-foreground/10" />
              {!open && (
                <span className="text-[10px] tracking-normal text-ink-foreground/35">
                  {g.items.length}
                </span>
              )}
              <ChevronDown
                className={cn(
                  'size-3.5 transition-transform duration-300',
                  open ? '' : '-rotate-90',
                )}
              />
            </button>
            <div
              inert={!open}
              className={cn(
                'grid transition-[grid-template-rows,opacity] duration-300 ease-out',
                open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
              )}
            >
              <div className="min-h-0 overflow-hidden">
                <div className="grid gap-1 pt-1">
                  {g.items.map((i) => {
                    const active = isNavActive(pathname, i.to)
                    return (
                      <Link
                        key={i.to}
                        to={i.to}
                        onClick={onNavigate}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-all duration-200',
                          active
                            ? 'bg-gradient-to-r from-primary/90 to-primary/40 text-ink-foreground shadow-[0_8px_24px_-8px_var(--primary)] hover:text-ink-foreground'
                            : 'text-ink-foreground/65 hover:translate-x-1 hover:bg-ink-foreground/5 hover:text-ink-foreground',
                        )}
                      >
                        {active && (
                          <span className="absolute top-1/2 -left-4 h-6 w-1 -translate-y-1/2 rounded-r-full bg-primary" />
                        )}
                        <span
                          className={cn(
                            'grid size-7 place-items-center rounded-lg transition-colors',
                            active
                              ? 'bg-ink-foreground/15'
                              : 'bg-ink-foreground/5 group-hover:bg-primary/30',
                          )}
                        >
                          <i.icon className="size-4" />
                        </span>
                        <span className="flex-1">{i.label}</span>
                      </Link>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        )
      })}
      {publicSiteTo && (
        <div className="relative mt-auto space-y-2 pt-4">
          <Link
            to={publicSiteTo}
            onClick={onNavigate}
            className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-ink-foreground/65 transition-colors hover:bg-ink-foreground/5 hover:text-ink-foreground"
          >
            <Globe className="size-4" /> {publicSiteLabel}
          </Link>
        </div>
      )}
    </nav>
  )
}

export function WorkspaceLayout({
  groups,
  user,
  onLogout,
  profileTo,
  notificationsTo,
  publicSiteTo,
  publicSiteLabel = 'Trang web công khai',
  brand = 'Emily Hotel',
  navLabel = 'Menu điều hướng',
  emptyNavText,
  sidebarId = 'workspace-sidebar',
  error,
  loading,
  loadingLabel = 'Đang tải…',
  contentWidth = 'contained',
  forbidden,
  children,
}: {
  groups: NavGroup[]
  user: { name: string; roleLabel: string; avatarUrl?: string }
  onLogout: () => void
  profileTo?: string
  notificationsTo?: string
  publicSiteTo?: string
  publicSiteLabel?: string
  brand?: string
  navLabel?: string
  emptyNavText?: string
  sidebarId?: string
  error?: string
  loading?: boolean
  loadingLabel?: string
  contentWidth?: 'contained' | 'bare'
  forbidden?: boolean
  children?: ReactNode
}) {
  const { pathname } = useLocation()
  const [openOn, setOpenOn] = useState<string | null>(null)
  const open = openOn === pathname
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const sidebarRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!open) return
    sidebarRef.current?.querySelector('a')?.focus()
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenOn(null)
        menuButtonRef.current?.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  if (loading) {
    return (
      <div className="flex min-h-screen bg-background">
        <p role="status" className="sr-only">
          {loadingLabel}
        </p>
        <div className="hidden w-64 border-r lg:block" />
        <div className="flex-1 space-y-4 p-8">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    )
  }

  const initial = user.name.trim().split(/\s+/).at(-1)?.[0]?.toUpperCase() ?? '?'

  return (
    <div className="flex min-h-screen bg-background">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:shadow-md"
      >
        Bỏ qua điều hướng
      </a>
      {open && (
        <button
          type="button"
          aria-label="Đóng menu"
          tabIndex={-1}
          onClick={() => setOpenOn(null)}
          className="fixed inset-0 z-30 bg-ink/50 lg:hidden"
        />
      )}
      <aside
        id={sidebarId}
        ref={sidebarRef}
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex h-full w-64 flex-col bg-ink transition-transform duration-300 lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:shrink-0 lg:translate-x-0 lg:transition-none',
          open ? 'translate-x-0' : 'invisible -translate-x-full lg:visible lg:translate-x-0',
        )}
      >
        <SideNav
          groups={groups}
          brand={brand}
          navLabel={navLabel}
          emptyNavText={emptyNavText}
          publicSiteTo={publicSiteTo}
          publicSiteLabel={publicSiteLabel}
          onNavigate={() => setOpenOn(null)}
        />
      </aside>
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur sm:px-8">
          <button
            ref={menuButtonRef}
            type="button"
            className="lg:hidden"
            onClick={() => setOpenOn(open ? null : pathname)}
            aria-label="Mở menu"
            aria-expanded={open}
            aria-controls={sidebarId}
          >
            <Menu className="size-5" />
          </button>
          <div className="ml-auto flex items-center gap-2">
            {notificationsTo && (
              <Link
                to={notificationsTo}
                aria-label="Thông báo"
                className="relative grid size-9 place-items-center rounded-full border bg-card transition-colors hover:bg-muted/50"
              >
                <Bell className="size-4" />
              </Link>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label={user.name}
                className="flex items-center gap-2 rounded-full border bg-card py-1 pr-3 pl-1 text-sm font-medium hover:bg-muted/50 transition-colors"
              >
                <Avatar className="size-7">
                  {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name} />}
                  <AvatarFallback className="bg-primary/15 text-xs text-primary">
                    {initial}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden max-w-[40vw] truncate sm:inline">{user.name}</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="font-medium text-foreground truncate">{user.name}</div>
                  <div className="text-xs font-normal text-muted-foreground">{user.roleLabel}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {profileTo && (
                  <DropdownMenuItem asChild>
                    <Link to={profileTo}>Hồ sơ & cài đặt</Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={onLogout}>
                  <LogOut className="size-4" /> Đăng xuất
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        {error && (
          <p
            role="alert"
            className="border-b border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive sm:px-8"
          >
            {error}
          </p>
        )}
        <main
          id="main"
          tabIndex={-1}
          className={cn(
            'flex-1 focus:outline-none',
            contentWidth === 'contained' && 'mx-auto w-full max-w-7xl px-4 py-8 sm:px-8',
          )}
        >
          {forbidden ? (
            <div className="py-20">
              <Unauthorized
                homeTo={groups[0]?.items[0]?.to ?? '/'}
                actionLabel="Về khu làm việc của tôi"
              />
            </div>
          ) : (
            (children ?? <Outlet />)
          )}
        </main>
      </div>
    </div>
  )
}
