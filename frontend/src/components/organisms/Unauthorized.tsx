import { ArrowRight, KeyRound } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router'
import { Button } from '../atoms'

/** Trang 403 theo prototype. Điều hướng và nội dung mô tả do nơi dùng truyền vào. */
export function Unauthorized({
  homeTo = '/',
  actionLabel = 'Về trang chủ',
  description = 'Vai trò hiện tại của bạn chưa được cấp quyền vào trang này.',
}: {
  homeTo?: string
  actionLabel?: string
  description?: ReactNode
}) {
  const { pathname } = useLocation()
  return (
    <div className="grid min-h-[70vh] place-items-center">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-[2rem] border bg-card">
        <div className="grid md:grid-cols-[1fr_220px]">
          <div className="p-10">
            <div className="text-xs tracking-[0.2em] text-primary uppercase">
              Lỗi 403 · Khu vực hạn chế
            </div>
            <h1 className="font-display mt-4 text-5xl leading-[1.1]">
              Cánh cửa này dành cho bộ phận khác
            </h1>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{description}</p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild className="rounded-full px-5">
                <Link to={homeTo}>
                  {actionLabel} <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          </div>
          <div className="relative hidden flex-col items-center justify-center gap-4 border-l bg-surface p-8 md:flex">
            <div className="grid size-24 place-items-center rounded-full border-2 border-dashed border-primary/40">
              <span className="grid size-16 place-items-center rounded-full bg-ink text-ink-foreground">
                <KeyRound className="size-6" />
              </span>
            </div>
            <div className="max-w-full truncate rounded-full bg-card px-3 py-1 font-mono text-[11px] text-muted-foreground">
              {pathname}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
