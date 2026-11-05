import { ChevronDown, Globe, LogOut, Menu } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, Outlet, useLocation } from 'react-router'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, Logo, Skeleton } from '../atoms'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../molecules'
import { Sheet, SheetContent, SheetDescription, SheetTitle, Unauthorized } from '../organisms'

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
  publicSiteTo,
  onNavigate,
}: {
  groups: NavGroup[]
  publicSiteTo?: string
  onNavigate?: () => void
}) {
  const { pathname } = useLocation()
  // Chọn tay (mở/đóng nhóm) chỉ có hiệu lực ở trang hiện tại; sang trang khác thì nhóm chứa trang đang mở tự mở lại.
  const [manual, setManual] = useState<{ path: string; map: Record<string, boolean> }>({
    path: '',
    map: {},
  })
  const map = manual.path === pathname ? manual.map : {}
  const activeTitle = groups.find((g) => g.items.some((i) => isNavActive(pathname, i.to)))?.title
  const isOpen = (title: string) => map[title] ?? title === activeTitle

  return (
    <nav className="no-scrollbar relative flex h-full flex-col gap-2 overflow-x-hidden overflow-y-auto bg-ink px-4 py-6 text-ink-foreground">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-20 -left-16 size-56 rounded-full bg-primary/30 blur-3xl" />
        <div className="absolute -right-20 -bottom-24 size-56 rounded-full bg-lavender/20 blur-3xl" />
      </div>
      <div className="relative px-2 pb-4 [&_*]:text-ink-foreground!">
        <Logo />
      </div>
      {groups.map((g) => {
        const open = isOpen(g.title)
        const hasActive = g.items.some((i) => isNavActive(pathname, i.to))
        return (
          <div key={g.title} className="relative">
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setManual({ path: pathname, map: { ...map, [g.title]: !open } })}
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
            className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-ink-foreground/65 transition-colors hover:bg-ink-foreground/5 hover:text-ink-foreground"
          >
            <Globe className="size-4" /> Trang web công khai
          </Link>
        </div>
      )}
    </nav>
  )
}

export function WorkspaceLayout({
  groups,
  user,
  workspaceLabel,
  onLogout,
  profileTo,
  publicSiteTo,
  loading,
  forbidden,
  children,
}: {
  groups: NavGroup[]
  user: { name: string; roleLabel: string }
  workspaceLabel: string
  onLogout: () => void
  profileTo?: string
  publicSiteTo?: string
  loading?: boolean
  forbidden?: boolean
  children?: ReactNode
}) {
  const [open, setOpen] = useState(false)

  if (loading) {
    return (
      <div className="flex min-h-screen">
        <div className="hidden w-64 border-r lg:block" />
        <div className="flex-1 space-y-4 p-8">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    )
  }

  const initial = user.name.trim().split(/\s+/).at(-1)?.[0] ?? '?'

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 bg-ink lg:block">
        <SideNav groups={groups} publicSiteTo={publicSiteTo} />
      </aside>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 border-0 bg-ink p-0">
          <SheetTitle className="sr-only">Menu điều hướng</SheetTitle>
          <SheetDescription className="sr-only">Các mục của khu làm việc</SheetDescription>
          <SideNav groups={groups} publicSiteTo={publicSiteTo} onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur sm:px-8">
          <button
            type="button"
            className="lg:hidden"
            onClick={() => setOpen(true)}
            aria-label="Mở menu"
          >
            <Menu className="size-5" />
          </button>
          <div className="text-sm text-muted-foreground">
            Emily Hotel · <span className="text-foreground">Khu làm việc {workspaceLabel}</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-2 rounded-full border bg-card py-1 pr-3 pl-1">
                <Avatar className="size-7">
                  <AvatarFallback className="bg-primary/15 text-xs text-primary">
                    {initial}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden text-sm sm:inline">{user.name}</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  {user.name}
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
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-8">
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
