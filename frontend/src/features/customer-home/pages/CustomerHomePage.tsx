import {
  ArrowRight,
  CalendarDays,
  ConciergeBell,
  MessageSquareHeart,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/atoms'
import { EmptyState, StatCard } from '@/components/molecules'
import { PageContainer, PageHeader } from '@/components/organisms'
import { useAuth } from '@/features/auth/auth-context'
import { getErrorMessage } from '@/lib/api-client'
import { vnd } from '@/lib/format'
import { NextStayCard } from '../components/NextStayCard'
import { useCustomerOverview } from '../hooks'
import { givenName, greetingFor } from '../overview'

const SHORTCUTS: { to: string; label: string; icon: LucideIcon }[] = [
  { to: '/customer/service-orders/new', label: 'Đặt dịch vụ phòng', icon: ConciergeBell },
  { to: '/my-feedback', label: 'Gửi đánh giá', icon: MessageSquareHeart },
  { to: '/my-bookings', label: 'Lịch sử đặt phòng', icon: CalendarDays },
]

/** Tổng quan của khách đã đăng nhập (prototype: /app/home). */
export function CustomerHomePage() {
  const { me } = useAuth()
  const { bookings, serviceOrderCount, summary } = useCustomerOverview()
  const name = givenName(me?.fullName ?? '')
  const [greetingTime] = useState(() => greetingFor(new Date().getHours()))
  const greeting = `${greetingTime}${name ? `, ${name}` : ''}`

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Tổng quan"
        title={greeting}
        subtitle="Mọi thông tin về kỳ nghỉ của bạn, ở cùng một nơi."
        actions={
          <Button asChild className="rounded-full">
            <Link to="/search">Đặt phòng mới</Link>
          </Button>
        }
      />

      {bookings.isPending && (
        <div role="status" className="py-8 text-muted-foreground">
          Đang tải kỳ nghỉ của bạn…
        </div>
      )}

      {bookings.isError && (
        <div
          role="alert"
          className="rounded-xl border border-destructive/20 bg-destructive/10 p-5 text-destructive"
        >
          {getErrorMessage(bookings.error, 'Không tải được thông tin đặt phòng.')}
        </div>
      )}

      {bookings.isSuccess && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Đặt phòng" value={summary.bookingCount} icon={CalendarDays} />
            <StatCard label="Số đêm đã ở" value={summary.nightsStayed} icon={CalendarDays} />
            <StatCard
              label="Yêu cầu dịch vụ"
              value={serviceOrderCount ?? '—'}
              icon={ConciergeBell}
            />
            <StatCard
              label="Tổng đã thanh toán"
              value={vnd(summary.paidTotal ?? 0)}
              icon={Wallet}
            />
          </div>
          <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
            {summary.next ? (
              <NextStayCard booking={summary.next} />
            ) : (
              <EmptyState
                title="Chưa có kỳ nghỉ sắp tới"
                body="Khi bạn đặt phòng, kỳ nghỉ tiếp theo sẽ hiện ở đây."
                action={
                  <Button asChild className="rounded-full">
                    <Link to="/search">Xem phòng</Link>
                  </Button>
                }
              />
            )}
            <div className="grid gap-3">
              {SHORTCUTS.map(({ to, label, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  className="card-soft flex items-center gap-3 p-4 hover:border-primary"
                >
                  <Icon className="size-5 text-primary" />
                  <span className="flex-1 text-sm font-medium">{label}</span>
                  <ArrowRight className="size-4 text-muted-foreground" />
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </PageContainer>
  )
}
