import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bell, ChevronDown, Menu, LogOut, Globe } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Logo } from "@/components/hms/SiteLayout";
import { Unauthorized } from "@/components/hms/Unauthorized";
import { useStore, useHydrated } from "@/lib/store";
import { canAccess, activeGroupTitle, navByRole, roleMeta } from "@/lib/nav";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app")({
  head: () => ({ meta: [{ name: "robots", content: "noindex" }] }),
  component: AppLayout,
});

function SideNav({ onNavigate }: { onNavigate?: () => void }) {
  const role = useStore((s) => s.role);
  const { pathname } = useLocation();
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({});
  const activeTitle = role === "GUEST" ? null : activeGroupTitle(role, pathname);
  // Landing on a page inside a collapsed section re-opens it; manual toggles otherwise win.
  useEffect(() => {
    if (activeTitle) setOpenMap((o) => (o[activeTitle] ? o : { ...o, [activeTitle]: true }));
  }, [activeTitle]);
  if (role === "GUEST") return null;
  const groups = navByRole[role];
  const isActive = (to: string) => pathname === to || pathname.startsWith(`${to}/`);
  const isOpen = (title: string) => openMap[title] ?? title === activeTitle;
  return (
    <nav className="no-scrollbar relative flex h-full flex-col gap-2 overflow-y-auto overflow-x-hidden bg-ink px-4 py-6 text-ink-foreground">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-16 -top-20 size-56 rounded-full bg-primary/30 blur-3xl" />
        <div className="absolute -bottom-24 -right-20 size-56 rounded-full bg-lavender/20 blur-3xl" />
      </div>
      <div className="relative px-2 pb-4 [&_*]:!text-ink-foreground"><Logo /></div>
      {groups.map((g) => {
        const open = isOpen(g.title);
        const hasActive = g.items.some((i) => isActive(i.to));
        return (
          <div key={g.title} className="relative">
            <button type="button" aria-expanded={open}
              onClick={() => setOpenMap((o) => ({ ...o, [g.title]: !open }))}
              className="group/head flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-[10px] font-medium uppercase tracking-[0.2em] text-ink-foreground/45 transition-colors hover:text-ink-foreground/85">
              <span className={cn("transition-colors", hasActive && "text-primary/90")}>{g.title}</span>
              <span className="h-px flex-1 bg-ink-foreground/10" />
              {!open && <span className="text-[10px] tracking-normal text-ink-foreground/35">{g.items.length}</span>}
              <ChevronDown className={cn("size-3.5 transition-transform duration-300", open ? "" : "-rotate-90")} />
            </button>
            <div inert={!open} className={cn("grid transition-[grid-template-rows,opacity] duration-300 ease-out", open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}>
              <div className="min-h-0 overflow-hidden">
                <div className="grid gap-1 pt-1">
                  {g.items.map((i) => {
                    const active = isActive(i.to);
                    return (
                      <Link key={i.to} to={i.to} onClick={onNavigate}
                        className={cn(
                          "group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-all duration-200",
                          active
                            ? "bg-gradient-to-r from-primary/90 to-primary/40 text-ink-foreground shadow-[0_8px_24px_-8px_var(--primary)] hover:text-ink-foreground"
                            : "text-ink-foreground/65 hover:translate-x-1 hover:bg-ink-foreground/5 hover:text-ink-foreground",
                        )}>
                        {active && <span className="absolute -left-4 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-primary" />}
                        <span className={cn("grid size-7 place-items-center rounded-lg transition-colors", active ? "bg-ink-foreground/15" : "bg-ink-foreground/5 group-hover:bg-primary/30")}>
                          <i.icon className="size-4" />
                        </span>
                        <span className="flex-1">{i.label}</span>
                        {i.proposed && <span className="size-1.5 rounded-full bg-lavender shadow-[0_0_8px_var(--lavender)]" title="Đề xuất UX" />}
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        );
      })}
      <div className="relative mt-auto space-y-2 pt-4">
        <Link to="/" className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-ink-foreground/65 transition-colors hover:bg-ink-foreground/5 hover:text-ink-foreground"><Globe className="size-4" /> Trang web công khai</Link>
      </div>
    </nav>
  );
}

function AppLayout() {
  const hydrated = useHydrated();
  const role = useStore((s) => s.role);
  const unread = useStore((s) => s.data.notifications.filter((n) => !n.read && n.roles.includes(s.role)).length);
  const setRole = useStore((s) => s.setRole);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const meta = roleMeta[role];

  if (!hydrated) return <div className="flex min-h-screen"><div className="hidden w-64 border-r lg:block" /><div className="flex-1 space-y-4 p-8"><Skeleton className="h-8 w-64" /><Skeleton className="h-32 w-full" /><Skeleton className="h-64 w-full" /></div></div>;
  const allowed = canAccess(role, pathname);

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 bg-ink lg:block"><SideNav /></aside>
      <Sheet open={open} onOpenChange={setOpen}><SheetContent side="left" className="w-72 border-0 bg-ink p-0"><SideNav onNavigate={() => setOpen(false)} /></SheetContent></Sheet>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur sm:px-8">
          <button className="lg:hidden" onClick={() => setOpen(true)} aria-label="Mở menu"><Menu className="size-5" /></button>
          <div className="text-sm text-muted-foreground">Emily Hotel · <span className="text-foreground">Khu làm việc {meta.label}</span></div>
          <div className="ml-auto flex items-center gap-2">
            {role !== "GUEST" && (
              <Link to="/app/notifications" className="relative grid size-9 place-items-center rounded-full border bg-card" aria-label="Thông báo">
                <Bell className="size-4" />
                {unread > 0 && <span className="absolute -right-0.5 -top-0.5 grid size-4 place-items-center rounded-full bg-primary text-[10px] text-primary-foreground">{unread}</span>}
              </Link>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-2 rounded-full border bg-card py-1 pl-1 pr-3">
                <Avatar className="size-7"><AvatarFallback className="bg-primary/15 text-xs text-primary">{meta.person.split(" ").slice(-1)[0][0]}</AvatarFallback></Avatar>
                <span className="hidden text-sm sm:inline">{meta.person}</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>{meta.person}<div className="text-xs font-normal text-muted-foreground">{meta.label}</div></DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild><Link to="/app/profile">Hồ sơ & cài đặt</Link></DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setRole("GUEST"); navigate({ to: "/login" }); }}><LogOut className="size-4" /> Đăng xuất</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className={cn("mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-8")}>
          {allowed ? <Outlet /> : <div className="py-20"><Unauthorized /></div>}
        </main>
      </div>
    </div>
  );
}

