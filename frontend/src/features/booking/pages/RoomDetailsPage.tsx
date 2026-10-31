import { Link, useParams, useSearchParams } from 'react-router'
import { Alert } from '@/components/Alert'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { getErrorMessage } from '@/lib/api-client'
import { env } from '@/lib/env'
import { useRoomTypeOverview } from '../hooks'
import { BedIcon, CheckIcon, ChildIcon, UsersIcon } from '../icons'
import { money, nightsBetween } from '../utils'

/**
 * UC 2.2.2 — View Room Details. Màn công khai cho Guest/Customer xem chi tiết một loại phòng
 * (mô tả, sức chứa, giá, tiện nghi) trước khi đặt. Giữ lại tiêu chí tìm kiếm trên URL để nút
 * đặt phòng đưa khách về đúng kết quả còn trống.
 */
export function RoomDetailsPage() {
  const { id = '' } = useParams()
  const [params] = useSearchParams()
  const overview = useRoomTypeOverview(id)

  const checkIn = params.get('checkIn') ?? ''
  const checkOut = params.get('checkOut') ?? ''
  const guests = params.get('guests') ?? ''
  const hasStay = /^\d{4}-\d{2}-\d{2}$/.test(checkIn) && nightsBetween(checkIn, checkOut) > 0
  const nights = hasStay ? nightsBetween(checkIn, checkOut) : 0

  const backToSearch = hasStay
    ? `/search?${new URLSearchParams({ checkIn, checkOut, guests: guests || '2' }).toString()}`
    : '/search'

  const room = overview.data

  return (
    <section className="mx-auto max-w-container space-y-6 px-4 py-10 font-body">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-widest text-primary uppercase">
            {env.appName}
          </p>
          <h1 className="font-display text-4xl font-semibold text-pearl-900">
            Chi tiết loại phòng
          </h1>
        </div>
        <Link
          to={backToSearch}
          className="inline-flex h-11 items-center text-sm font-semibold tracking-wider text-stone-700 uppercase hover:text-primary"
        >
          ← Quay lại tìm phòng
        </Link>
      </div>

      {overview.isPending && <p role="status">Đang tải chi tiết loại phòng…</p>}

      {overview.isError && (
        <Alert tone="danger">
          {getErrorMessage(overview.error, 'Không tìm thấy loại phòng này.')}
          <div className="mt-3">
            <Link to="/search" className="text-sm font-semibold text-primary underline">
              ← Tìm phòng
            </Link>
          </div>
        </Alert>
      )}

      {room && (
        <div className="grid items-start gap-6 lg:grid-cols-[1fr_360px]">
          {/* Cột trái: ảnh minh hoạ + mô tả + tiện nghi */}
          <div className="space-y-6">
            <div className="relative flex h-56 items-center justify-center overflow-hidden rounded-xl border border-stone-300 bg-gradient-to-br from-cream-100 to-brandy-100 sm:h-72">
              <BedIcon className="size-16 text-primary/50" />
              <span className="absolute top-4 left-4">
                <Badge tone="success">Còn nhận đặt</Badge>
              </span>
            </div>

            <div className="space-y-3 rounded-xl border border-stone-300 bg-white p-6">
              <h2 className="font-display text-xl font-semibold text-pearl-900">Giới thiệu</h2>
              <p className="leading-relaxed whitespace-pre-line text-stone-700">
                {room.description?.trim() || 'Loại phòng này chưa có mô tả chi tiết.'}
              </p>
            </div>

            <div className="space-y-4 rounded-xl border border-stone-300 bg-white p-6">
              <h2 className="font-display text-xl font-semibold text-pearl-900">Tiện nghi</h2>
              {room.amenities.length === 0 ? (
                <p className="text-sm text-stone-700">
                  Chưa cập nhật tiện nghi cho loại phòng này.
                </p>
              ) : (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {room.amenities.map((amenity) => (
                    <li
                      key={amenity.id}
                      className="inline-flex items-center gap-2 text-sm text-stone-700"
                    >
                      <CheckIcon className="size-4 shrink-0 text-primary" />
                      {amenity.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Cột phải: tóm tắt + giá + CTA */}
          <aside className="h-fit space-y-5 rounded-xl border border-stone-300 bg-cream-50 p-6 lg:sticky lg:top-6">
            <div>
              <p className="text-[11px] font-semibold tracking-widest text-primary uppercase">
                Loại phòng
              </p>
              <h2 className="font-display text-2xl font-semibold text-pearl-900">{room.name}</h2>
            </div>

            <dl className="space-y-2 border-y border-stone-300 py-4 text-sm">
              <div className="flex items-center justify-between gap-4">
                <dt className="inline-flex items-center gap-1.5 text-stone-700">
                  <UsersIcon className="size-4 text-primary" /> Người lớn tối đa
                </dt>
                <dd className="font-semibold">{room.adultCapacity}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="inline-flex items-center gap-1.5 text-stone-700">
                  <ChildIcon className="size-4 text-primary" /> Trẻ em tối đa
                </dt>
                <dd className="font-semibold">{room.childCapacity}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-stone-700">Sức chứa tối đa</dt>
                <dd className="font-semibold">{room.capacity} khách</dd>
              </div>
            </dl>

            <div>
              <p className="text-3xl font-bold whitespace-nowrap text-primary tabular-nums">
                {money.format(room.pricePerNight)}
              </p>
              <p className="text-xs text-stone-700">mỗi đêm</p>
              {hasStay && (
                <p className="mt-1 text-sm whitespace-nowrap text-stone-700 tabular-nums">
                  Tạm tính {nights} đêm: {money.format(room.pricePerNight * nights)}
                </p>
              )}
            </div>

            <Link to={backToSearch} className="block">
              <Button className="w-full">
                {hasStay ? 'Chọn phòng này & đặt' : 'Chọn ngày để đặt'}
              </Button>
            </Link>
            <p className="text-xs text-stone-700">
              Tình trạng phòng trống và tổng tiền chính thức do hệ thống xác nhận khi đặt.
            </p>
          </aside>
        </div>
      )}
    </section>
  )
}
