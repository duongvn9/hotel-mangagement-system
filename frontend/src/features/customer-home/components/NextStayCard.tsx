import { ArrowRight, Moon, Users } from 'lucide-react'
import { Link } from 'react-router'
import { Button, StatusBadge } from '@/components/atoms'
import type { MyBookingItem } from '@/features/booking/api'
import { nightsBetween } from '@/features/booking/utils'
import { assetUrl } from '@/lib/asset-url'
import { fdate } from '@/lib/format'
import { cn } from '@/lib/utils'

/** Thẻ "Kỳ nghỉ tiếp theo" của trang Tổng quan; ảnh và số phòng chỉ hiện khi API có dữ liệu. */
export function NextStayCard({ booking }: { booking: MyBookingItem }) {
  const image = assetUrl(booking.roomTypeImage)
  const nights = nightsBetween(booking.checkIn, booking.checkOut)
  const guests = booking.adultCount + booking.childCount
  const title = booking.roomTypeName ?? `Đặt phòng ${booking.code}`
  const room =
    booking.roomNumber &&
    `Phòng ${booking.roomNumber}${booking.roomFloor !== undefined ? ` · Tầng ${booking.roomFloor}` : ''}`

  return (
    <div className={cn('card-soft p-2', image && 'md:grid md:grid-cols-[0.78fr_1fr] md:gap-2')}>
      {image && (
        <div className="relative overflow-hidden rounded-xl">
          <img src={image} alt="" className="h-56 w-full object-cover md:h-full" />
          <div className="absolute inset-0 bg-gradient-to-t from-ink/50 via-ink/10 to-transparent" />
          {room && (
            <div className="absolute bottom-3 left-3 rounded-full bg-ink/55 px-3 py-1 text-xs font-medium text-ink-foreground backdrop-blur-sm">
              {room}
            </div>
          )}
        </div>
      )}
      <div className="flex flex-col p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-medium tracking-[0.12em] whitespace-nowrap text-muted-foreground uppercase">
            Kỳ nghỉ tiếp theo
          </span>
          <StatusBadge status={booking.status} />
        </div>
        <h2 className="font-display mt-2 text-[26px] leading-[1.2] text-balance">{title}</h2>
        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Users className="size-3.5" /> {guests} khách
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Moon className="size-3.5" /> {nights} đêm
          </span>
        </p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-border/50 bg-surface px-4 py-3">
            <div className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
              Nhận phòng
            </div>
            <div className="mt-1 text-sm font-medium">{fdate(booking.checkIn)}</div>
          </div>
          <div className="rounded-xl border border-border/50 bg-surface px-4 py-3">
            <div className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
              Trả phòng
            </div>
            <div className="mt-1 text-sm font-medium">{fdate(booking.checkOut)}</div>
          </div>
        </div>
        <div className="mt-auto grid grid-cols-[1.15fr_1fr] gap-2 pt-6">
          <Button asChild className="w-full justify-center rounded-full px-3">
            <Link to={`/booking/${booking.id}`}>
              Xem đặt phòng <ArrowRight className="size-4" />
            </Link>
          </Button>
          {booking.status === 'CHECKED_IN' && (
            <Button asChild variant="outline" className="w-full justify-center rounded-full px-3">
              <Link to="/customer/service-orders/new">Đặt dịch vụ</Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
