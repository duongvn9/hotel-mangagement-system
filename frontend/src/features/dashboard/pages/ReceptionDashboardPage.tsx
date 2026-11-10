import { Link } from 'react-router'
import { BedDouble, LogIn, LogOut, UserPlus, Wallet } from 'lucide-react'
import { Button, StatusBadge } from '@/components/atoms'
import { Alert, StatCard } from '@/components/molecules'
import { PageContainer, PageHeader, Panel } from '@/components/organisms'
import { getErrorMessage } from '@/lib/api-client'
import { useAuth } from '@/features/auth/auth-context'
import type { BookingListItem } from '@/features/booking/api'
import { useSameDayList } from '@/features/booking/hooks'
import { todayISO } from '@/features/booking/utils'
import { BookingAttentionAlert } from '@/features/booking/components/BookingAttentionAlert'
import { useReceptionDashboard } from '../hooks'

function getGreeting(fullName?: string) {
  const hour = new Date().getHours()
  const timeGreeting =
    hour < 12 ? 'Chào buổi sáng' : hour < 18 ? 'Chào buổi chiều' : 'Chào buổi tối'
  const firstName = fullName?.trim().split(' ').pop()
  return firstName ? `${timeGreeting}, ${firstName}` : `${timeGreeting}, Yến`
}

interface BookingListProps {
  rows: BookingListItem[]
  emptyText: string
}

function BookingList({ rows, emptyText }: BookingListProps) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyText}</p>
  }

  return (
    <div className="divide-y divide-border">
      {rows.map((b) => {
        const roomNumbers = b.rooms
          ?.map((r) => r.roomNumber)
          .filter(Boolean)
          .join(', ')
        return (
          <Link
            key={b.id || b.code}
            to={`/reception/bookings/${b.code}`}
            className="flex items-center justify-between py-3 text-sm transition-colors hover:text-primary"
          >
            <span>
              <span className="block font-medium text-foreground">{b.guestName || 'Khách'}</span>
              <span className="text-xs text-muted-foreground">
                {b.code}
                {roomNumbers ? ` · Phòng ${roomNumbers}` : ''}
              </span>
            </span>
            <StatusBadge status={b.status} />
          </Link>
        )
      })}
    </div>
  )
}

/** Bảng điều khiển lễ tân: tình hình hôm nay tại quầy (khớp prototype app.reception.tsx). */
export function ReceptionDashboardPage() {
  const { me } = useAuth()
  const dashboard = useReceptionDashboard()
  const sameDay = useSameDayList(todayISO())

  const data = dashboard.data
  const sameDayData = sameDay.data

  const arrivals = sameDayData?.arrivals ?? []
  const departures = sameDayData?.departures ?? []

  const arrivalsTotal =
    sameDayData?.summary.arrivals.total ??
    (data?.frontDesk.available ? data.frontDesk.arrivals.total : 0)
  const departuresTotal =
    sameDayData?.summary.departures.total ??
    (data?.frontDesk.available ? data.frontDesk.departures.total : 0)

  const roomsFree = data?.rooms.available ? data.rooms.free : 0
  const roomsTotal = data?.rooms.available ? data.rooms.total : 0

  const pendingRequests = data?.requests.available
    ? data.requests.serviceOrdersPendingReview +
      data.requests.issuesPendingReview +
      data.requests.feedbackUnreplied
    : 0

  const requestsHint = data?.requests.available
    ? `${data.requests.serviceOrdersPendingReview} dịch vụ · ${data.requests.issuesPendingReview} sự cố`
    : undefined

  const title = getGreeting(me?.fullName)

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        eyebrow="Lễ tân"
        title={title}
        subtitle="Tình hình tại quầy lễ tân hôm nay."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" className="rounded-full">
              <Link to="/reception/front-desk">Mở quầy lễ tân</Link>
            </Button>
            <Button asChild className="rounded-full">
              <Link to="/reception/booking/new">
                <UserPlus className="size-4" />
                Tại quầy
              </Link>
            </Button>
          </div>
        }
      />

      <BookingAttentionAlert />

      {dashboard.isError && (
        <Alert tone="danger">
          <p className="mb-2">{getErrorMessage(dashboard.error)}</p>
          <Button type="button" variant="secondary" onClick={() => void dashboard.refetch()}>
            Thử lại
          </Button>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Khách đến hôm nay" value={arrivalsTotal} icon={LogIn} />
        <StatCard label="Khách trả phòng" value={departuresTotal} icon={LogOut} />
        <StatCard label="Phòng trống" value={`${roomsFree} / ${roomsTotal}`} icon={BedDouble} />
        <StatCard
          label="Việc cần xử lý"
          value={pendingRequests}
          hint={requestsHint}
          icon={Wallet}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel
          title="Khách đến"
          action={
            <Link to="/reception/front-desk" className="text-xs text-primary hover:underline">
              Nhận phòng →
            </Link>
          }
        >
          <BookingList rows={arrivals} emptyText="Không có khách đến." />
        </Panel>
        <Panel
          title="Khách trả phòng"
          action={
            <Link to="/reception/front-desk" className="text-xs text-primary hover:underline">
              Trả phòng →
            </Link>
          }
        >
          <BookingList rows={departures} emptyText="Không có khách đi." />
        </Panel>
      </div>
    </PageContainer>
  )
}
