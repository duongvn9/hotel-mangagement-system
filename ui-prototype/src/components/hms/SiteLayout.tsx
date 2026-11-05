import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { roleMeta } from "@/lib/nav";
import { cn } from "@/lib/utils";

const links = [
  { to: "/", label: "Trang chủ" },
  { to: "/rooms", label: "Phòng & suite" },
  { to: "/experiences", label: "Trải nghiệm" },
  { to: "/lookup", label: "Tra cứu đặt phòng" },
] as const;

export function Logo({ light }: { light?: boolean }) {
  return (
    <Link to="/" className={cn("flex shrink-0 items-center gap-2 whitespace-nowrap text-lg font-semibold tracking-tight", light ? "text-ink-foreground" : "text-foreground")}>
      <span className="grid size-8 place-items-center rounded-full bg-primary font-display text-lg text-primary-foreground">P</span>
      Emily Hotel
    </Link>
  );
}

export function SiteLayout({ children, overlay }: { children: ReactNode; overlay?: boolean }) {
  const role = useStore((s) => s.role);
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen bg-background">
      <header className={cn("z-40 w-full", overlay ? "absolute inset-x-0 top-0" : "sticky top-0 border-b bg-background/85 backdrop-blur")}>
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 lg:px-8">
          <Logo light={overlay} />
          <nav className={cn("hidden items-center gap-1 rounded-full p-1 md:flex", overlay ? "bg-ink/25 backdrop-blur" : "bg-surface")}>
            {links.map((l) => (
              <Link key={l.to} to={l.to} activeOptions={{ exact: l.to === "/" }} className={cn("whitespace-nowrap rounded-full px-3 py-2 text-sm lg:px-4 transition-colors", overlay ? "text-ink-foreground/85 hover:text-ink-foreground" : "text-muted-foreground hover:text-foreground")} activeProps={{ className: overlay ? "bg-card/20 text-ink-foreground" : "bg-card text-foreground shadow-sm" }}>
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="hidden items-center gap-2 md:flex">
            {role === "GUEST" ? (
              <>
                <Button asChild variant="ghost" className={cn("rounded-full", overlay && "text-ink-foreground hover:bg-card/15 hover:text-ink-foreground")}><Link to="/login">Đăng nhập</Link></Button>
                <Button asChild className="rounded-full"><Link to="/rooms">Đặt phòng</Link></Button>
              </>
            ) : (
              <Button asChild className="rounded-full"><Link to={roleMeta[role].home}>Vào khu làm việc</Link></Button>
            )}
          </div>
          <button className={cn("md:hidden", overlay && "text-ink-foreground")} onClick={() => setOpen(!open)} aria-label="Mở menu">{open ? <X /> : <Menu />}</button>
        </div>
        {open && (
          <div className="mx-4 mb-4 rounded-2xl border bg-card p-3 shadow-lg md:hidden">
            {links.map((l) => <Link key={l.to} to={l.to} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2.5 text-sm hover:bg-surface">{l.label}</Link>)}
            <Link to="/login" onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2.5 text-sm font-medium text-primary">Đăng nhập</Link>
          </div>
        )}
      </header>
      <main>{children}</main>
      <footer className="mt-24 bg-ink text-ink-foreground">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 md:grid-cols-4 lg:px-8">
          <div className="md:col-span-2">
            <Logo light />
            <p className="mt-4 max-w-sm font-display text-3xl leading-tight">Sang trọng tĩnh lặng bên vịnh biển.</p>
          </div>
          <div className="text-sm">
            <div className="mb-3 text-ink-foreground/50">Lưu trú</div>
            <div className="grid gap-2"><Link to="/rooms">Phòng & suite</Link><Link to="/experiences">Trải nghiệm</Link><Link to="/lookup">Tra cứu đặt phòng</Link></div>
          </div>
          <div className="text-sm">
            <div className="mb-3 text-ink-foreground/50">Liên hệ</div>
            <div className="grid gap-2 text-ink-foreground/80"><span>12 Trần Phú, Nha Trang</span><span>+84 258 000 1234</span><span>stay@emilyhotel.vn</span></div>
          </div>
        </div>
        <div className="border-t border-ink-foreground/10 py-5 text-center text-xs text-ink-foreground/50">© 2026 Emily Hotel · Bản mẫu thiết kế tương tác</div>
      </footer>
    </div>
  );
}
