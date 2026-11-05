import { Link, useLocation } from "@tanstack/react-router";
import { ArrowRight, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { roleMeta } from "@/lib/nav";

export function Unauthorized() {
  const role = useStore((s) => s.role);
  const { pathname } = useLocation();
  const guest = role === "GUEST";
  return (
    <div className="grid min-h-[70vh] place-items-center">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-[2rem] border bg-card">
        <div className="grid md:grid-cols-[1fr_220px]">
          <div className="p-10">
            <div className="text-xs uppercase tracking-[0.2em] text-primary">Lỗi 403 · Khu vực hạn chế</div>
            <h1 className="mt-4 font-display text-5xl leading-[1.1]">Cánh cửa này dành cho bộ phận khác</h1>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              {guest ? "Vui lòng đăng nhập để tiếp tục vào khu làm việc." : <>Bạn đang dùng vai trò <span className="font-medium text-foreground">{roleMeta[role].label}</span>, vai trò này chưa được cấp quyền vào trang này.</>}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild className="rounded-full px-5">
                {guest ? <Link to="/login">Đăng nhập <ArrowRight className="size-4" /></Link>
                  : <Link to={roleMeta[role].home}>Về khu làm việc của tôi <ArrowRight className="size-4" /></Link>}
              </Button>
              <Button asChild variant="ghost" className="rounded-full"><Link to="/">Trang chủ</Link></Button>
            </div>
          </div>
          <div className="relative hidden flex-col items-center justify-center gap-4 border-l bg-surface p-8 md:flex">
            <div className="grid size-24 place-items-center rounded-full border-2 border-dashed border-primary/40">
              <span className="grid size-16 place-items-center rounded-full bg-ink text-ink-foreground"><KeyRound className="size-6" /></span>
            </div>
            <div className="max-w-full truncate rounded-full bg-card px-3 py-1 font-mono text-[11px] text-muted-foreground">{pathname}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
