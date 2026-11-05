import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { BedDouble, Check, ChevronLeft } from 'lucide-react'
import { Button } from '@/components/atoms'
import { KeyValue } from '@/components/molecules'
import { getErrorMessage } from '@/lib/api-client'
import { assetUrl } from '@/lib/asset-url'
import { vnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useRoomTypeOverview } from '../hooks'
import { nightsBetween } from '../utils'

/**
 * UC 2.2.2 — View Room Details. Màn công khai cho Guest/Customer xem chi tiết một loại phòng
 * (mô tả, sức chứa, giá, tiện nghi) trước khi đặt. Giữ lại tiêu chí tìm kiếm trên URL để nút
 * đặt phòng đưa khách về đúng kết quả còn trống.
 */
export function RoomDetailsPage() {
  const { id = '' } = useParams()
  const [params] = useSearchParams()
  const overview = useRoomTypeOverview(id)
  const images = overview.data?.images ?? []

  const [active, setActive] = useState(0)
  const [lastId, setLastId] = useState(id)

  if (lastId !== id) {
    setLastId(id)
    setActive(0)
  }

  // Tự động chuyển ảnh mỗi 4s khi có nhiều hơn 1 ảnh.
  useEffect(() => {
    if (images.length < 2) return
    const timer = setInterval(() => setActive((i) => (i + 1) % images.length), 4000)
    return () => clearInterval(timer)
  }, [images.length])

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
    <div className="mx-auto max-w-7xl px-5 py-8 lg:px-8">
      <Link
        to={backToSearch}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        Tất cả phòng
      </Link>

      {overview.isPending && (
        <div className="py-12" role="status">
          <p className="text-muted-foreground">Đang tải chi tiết loại phòng…</p>
        </div>
      )}

      {overview.isError && (
        <div
          role="alert"
          className="mt-6 rounded-xl border border-destructive/20 bg-destructive/10 p-6 text-destructive"
        >
          {getErrorMessage(overview.error, 'Không tìm thấy loại phòng này.')}
          <div className="mt-3">
            <Link to="/search" className="text-sm font-semibold text-primary underline">
              ← Tìm phòng
            </Link>
          </div>
        </div>
      )}

      {room && (
        <>
          <h1 className="mt-4 font-display text-5xl md:text-6xl">{room.name}</h1>
          <p className="mt-2 text-muted-foreground">
            Tối đa {room.capacity} khách · {room.adultCapacity} người lớn, {room.childCapacity} trẻ
            em
          </p>

          <div className="mt-8 grid gap-3 md:grid-cols-[1fr_180px]">
            {images.length > 0 ? (
              <img
                src={assetUrl(images[active] ?? images[0])}
                alt={room.name}
                className="aspect-[16/10] w-full rounded-3xl object-cover"
              />
            ) : (
              <div className="flex aspect-[16/10] w-full items-center justify-center rounded-3xl bg-surface text-muted-foreground">
                <BedDouble className="size-16 opacity-40" />
              </div>
            )}
            {images.length > 1 && (
              <div className="grid grid-cols-4 gap-3 md:grid-cols-1">
                {images.map((g, i) => (
                  <button
                    key={g + i}
                    type="button"
                    onClick={() => setActive(i)}
                    aria-label={`Xem ảnh ${i + 1}`}
                    className={cn(
                      'overflow-hidden rounded-2xl ring-2 transition',
                      active === i
                        ? 'ring-primary'
                        : 'opacity-70 ring-transparent hover:opacity-100',
                    )}
                  >
                    <img
                      src={assetUrl(g)}
                      alt={`${room.name} — ảnh ${i + 1}`}
                      loading="lazy"
                      className="aspect-square w-full object-cover md:aspect-[4/3]"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_380px]">
            {/* Cột trái: giới thiệu + tiện nghi + chính sách */}
            <div>
              <h2 className="text-lg font-semibold">Về phòng này</h2>
              <p className="mt-2 leading-relaxed whitespace-pre-line text-muted-foreground">
                {room.description?.trim() || 'Loại phòng này chưa có mô tả chi tiết.'}
              </p>

              <h2 className="mt-8 text-lg font-semibold">Tiện nghi</h2>
              {room.amenities.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  Chưa cập nhật tiện nghi cho loại phòng này.
                </p>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  {room.amenities.map((amenity) => (
                    <span
                      key={amenity.id}
                      className="inline-flex items-center gap-1.5 rounded-full bg-surface px-4 py-2 text-sm text-foreground"
                    >
                      <Check className="size-3.5 text-primary" />
                      {amenity.name}
                    </span>
                  ))}
                </div>
              )}

              <h2 className="mt-8 text-lg font-semibold">Chính sách</h2>
              <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                <li>Nhận phòng từ 14:00 · Trả phòng trước 12:00</li>
                <li>Đặt cọc để giữ phòng; phần còn lại thanh toán khi trả phòng</li>
                <li>Phòng được giữ trong 15 phút khi bạn tạo đơn đặt phòng</li>
              </ul>
            </div>

            {/* Cột phải: tóm tắt + giá + CTA */}
            <aside className="card-soft sticky top-24 h-fit space-y-5 p-6">
              <div>
                <p className="text-xs font-semibold tracking-widest text-primary uppercase">
                  Loại phòng
                </p>
                <h2 className="font-display text-2xl font-semibold text-foreground">{room.name}</h2>
              </div>

              <div className="divide-y divide-border border-y border-border">
                <KeyValue k="Người lớn tối đa" v={`${room.adultCapacity} người`} />
                <KeyValue k="Trẻ em tối đa" v={`${room.childCapacity} bé`} />
                <KeyValue k="Sức chứa tối đa" v={`${room.capacity} khách`} />
              </div>

              <div>
                <div className="text-3xl font-bold tabular-nums text-foreground">
                  {vnd(room.pricePerNight)}
                  <span className="text-sm font-normal text-muted-foreground"> / đêm</span>
                </div>
                {hasStay && (
                  <p className="mt-1 text-sm text-muted-foreground tabular-nums">
                    Tạm tính {nights} đêm: {vnd(room.pricePerNight * nights)}
                  </p>
                )}
              </div>

              <Button asChild size="lg" className="w-full rounded-full">
                <Link to={backToSearch}>
                  {hasStay ? 'Chọn phòng này & đặt' : 'Chọn ngày để đặt'}
                </Link>
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Tình trạng phòng trống và tổng tiền chính thức do hệ thống xác nhận khi đặt.
              </p>
            </aside>
          </div>
        </>
      )}
    </div>
  )
}
