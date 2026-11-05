import { addDays, format } from 'date-fns'
import { BedDouble, Maximize2, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Button, Skeleton, Slider } from '@/components/atoms'
import { EmptyState } from '@/components/molecules'
import { RoomCard, SearchBar, type SearchValue } from '@/components/organisms'
import { getErrorMessage } from '@/lib/api-client'
import { assetUrl } from '@/lib/asset-url'
import { fshort, vnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { AvailableRoom, SearchAvailabilityParams } from '../api'
import { useAvailability } from '../hooks'
import { nightsBetween } from '../utils'

interface RoomTypeMeta {
  size: number
  bed: string
  description: string
  amenities: string[]
}

const ROOM_TYPE_META: Record<string, RoomTypeMeta> = {
  standard: {
    size: 28,
    bed: '2 giường đơn',
    description:
      'Phòng hai giường yên tĩnh, ngập ánh sáng nhìn ra khu vườn — lý tưởng cho bạn bè hoặc đồng nghiệp.',
    amenities: ['Wi-Fi', 'Điều hoà', 'Sen mưa', 'Bàn làm việc'],
  },
  deluxe: {
    size: 36,
    bed: '1 giường King',
    description: 'Ốp gỗ sồi, chất liệu lanh và vách kính kịch trần đón trọn vịnh lúc bình minh.',
    amenities: ['Wi-Fi', 'Hướng biển', 'Minibar', 'Bồn tắm', 'TV thông minh'],
  },
  family: {
    size: 44,
    bed: '1 giường King + ghế dài',
    description:
      'Không gian rộng rãi cho gia đình với ghế dài đọc sách và chỗ ngồi bên cửa sổ nhìn ra vườn.',
    amenities: ['Wi-Fi', 'Hướng vườn', 'Minibar', 'Tiện nghi cho trẻ em', 'Bồn tắm'],
  },
  suite: {
    size: 68,
    bed: '1 giường King',
    description:
      'Phòng khách riêng, ban công riêng và chi tiết đồng thau — hạng phòng được yêu thích nhất.',
    amenities: [
      'Wi-Fi',
      'Ban công hướng biển',
      'Phòng khách',
      'Quản gia riêng',
      'Bồn tắm',
      'Máy pha espresso',
    ],
  },
}

function getRoomTypeMeta(name: string, capacity: number): RoomTypeMeta {
  const lower = name.toLowerCase()
  if (lower.includes('suite')) return ROOM_TYPE_META.suite
  if (lower.includes('gia đình') || lower.includes('family')) return ROOM_TYPE_META.family
  if (lower.includes('deluxe')) return ROOM_TYPE_META.deluxe
  if (lower.includes('standard') || lower.includes('đôi') || lower.includes('vườn')) {
    return ROOM_TYPE_META.standard
  }
  return {
    size: capacity >= 4 ? 44 : capacity >= 3 ? 36 : 28,
    bed:
      capacity >= 4 ? '1 giường King + ghế dài' : capacity >= 2 ? '1 giường King' : '1 giường đơn',
    description: 'Phòng tiện nghi, thiết kế hiện đại và ngập tràn ánh sáng tự nhiên.',
    amenities: ['Wi-Fi', 'Điều hoà', 'Sen mưa', 'Bàn làm việc'],
  }
}

function defaultCriteria(): SearchAvailabilityParams {
  const base = new Date()
  base.setHours(0, 0, 0, 0)
  const checkIn = format(addDays(base, 3), 'yyyy-MM-dd')
  const checkOut = format(addDays(base, 6), 'yyyy-MM-dd')
  return { checkIn, checkOut, guests: 2 }
}

/** Đọc tiêu chí hợp lệ từ URL để chạy UC05; trả null khi chưa đủ/không hợp lệ. */
function readCriteria(params: URLSearchParams): SearchAvailabilityParams | null {
  const checkIn = params.get('checkIn') ?? ''
  const checkOut = params.get('checkOut') ?? ''
  const guests = Number(params.get('guests'))
  const valid =
    /^\d{4}-\d{2}-\d{2}$/.test(checkIn) &&
    /^\d{4}-\d{2}-\d{2}$/.test(checkOut) &&
    nightsBetween(checkIn, checkOut) > 0 &&
    Number.isInteger(guests) &&
    guests >= 1
  if (!valid) return null
  return { checkIn, checkOut, guests }
}

interface TypeGroup {
  images: string[]
  roomTypeId: string
  name: string
  pricePerNight: number
  capacity: number
  rooms: AvailableRoom[]
  meta: RoomTypeMeta
}

/** UC05 — Search Rooms. Guest và Customer đều dùng được (màn công khai). */
export function SearchRoomsPage() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const urlCriteria = readCriteria(params)
  const criteria = urlCriteria ?? defaultCriteria()

  // Số phòng đã chọn theo loại, dùng để sang bước tạo booking.
  const [selection, setSelection] = useState<Record<string, number>>({})
  const [max, setMax] = useState(5000000)
  const [sort, setSort] = useState<'price' | 'size'>('price')

  const availability = useAvailability(criteria)
  const nights = nightsBetween(criteria.checkIn, criteria.checkOut)

  const groups = useMemo<TypeGroup[]>(() => {
    const byType = new Map<string, AvailableRoom[]>()
    for (const room of availability.data ?? []) {
      const list = byType.get(room.roomTypeId) ?? []
      list.push(room)
      byType.set(room.roomTypeId, list)
    }
    return [...byType.entries()]
      .map(([id, rooms]) => {
        const name = rooms[0]?.roomTypeName ?? 'Phòng'
        const capacity = rooms[0]?.capacity ?? 2
        return {
          roomTypeId: id,
          images: rooms[0]?.images ?? [],
          name,
          pricePerNight: rooms[0]?.pricePerNight ?? 0,
          capacity,
          rooms,
          meta: getRoomTypeMeta(name, capacity),
        }
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [availability.data])

  const list = useMemo(() => {
    return groups
      .filter((g) => g.pricePerNight <= max)
      .sort((a, b) => {
        if (sort === 'price') return a.pricePerNight - b.pricePerNight
        return b.meta.size - a.meta.size
      })
  }, [groups, max, sort])

  const selectedRoomIds = useMemo(
    () =>
      groups.flatMap((group) =>
        group.rooms.slice(0, selection[group.roomTypeId] ?? 0).map((room) => room.id),
      ),
    [groups, selection],
  )

  const estimatedTotal = useMemo(
    () =>
      groups.reduce(
        (sum, group) => sum + (selection[group.roomTypeId] ?? 0) * group.pricePerNight * nights,
        0,
      ),
    [groups, selection, nights],
  )

  const handleSearch = ({ from, to, guests }: SearchValue) => {
    setSelection({})
    setParams({
      checkIn: from,
      checkOut: to,
      guests: String(guests),
    })
  }

  function proceed() {
    if (selectedRoomIds.length === 0) return
    const query = new URLSearchParams({
      checkIn: criteria.checkIn,
      checkOut: criteria.checkOut,
      guests: String(criteria.guests),
      rooms: selectedRoomIds.join(','),
    })
    navigate(`/booking/new?${query.toString()}`)
  }

  return (
    <div className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
      <h1 className="font-display text-5xl">Tìm phòng của bạn</h1>
      <p className="mt-2 text-muted-foreground">
        {fshort(criteria.checkIn)} — {fshort(criteria.checkOut)} · {nights} đêm · {criteria.guests}{' '}
        khách
      </p>

      <div className="mt-6">
        <SearchBar
          compact
          initial={{
            from: criteria.checkIn,
            to: criteria.checkOut,
            guests: criteria.guests,
          }}
          onSearch={handleSearch}
        />
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-[260px_1fr]">
        <aside className="card-soft h-fit space-y-6 p-5">
          <div>
            <div className="text-sm font-semibold">Giá tối đa / đêm</div>
            <div className="mt-1 text-xs text-muted-foreground">{vnd(max)}</div>
            <Slider
              className="mt-4"
              min={500000}
              max={5000000}
              step={100000}
              value={[max]}
              onValueChange={(v) => setMax(v[0])}
              aria-label="Giá tối đa mỗi đêm"
            />
          </div>
          <div>
            <div className="mb-2 text-sm font-semibold">Sắp xếp</div>
            <div className="flex gap-2">
              {(['price', 'size'] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setSort(k)}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                    sort === k
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:text-foreground',
                  )}
                >
                  {k === 'price' ? 'Giá thấp nhất' : 'Rộng nhất'}
                </button>
              ))}
            </div>
          </div>
        </aside>

        <div className="grid gap-5">
          <p className="sr-only" aria-live="polite">
            {nights} đêm · {availability.data?.length ?? 0} phòng phù hợp
          </p>

          {availability.isPending && (
            <div className="grid gap-5" aria-busy="true" aria-label="Đang tìm phòng trống">
              <p role="status" className="sr-only">
                Đang tìm phòng trống…
              </p>
              {[1, 2, 3].map((n) => (
                <div key={n} className="card-soft grid h-64 md:grid-cols-[320px_1fr]">
                  <Skeleton className="h-56 w-full md:h-full" />
                  <div className="space-y-4 p-6">
                    <Skeleton className="h-8 w-2/3" />
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-16 w-full" />
                    <div className="flex justify-between pt-4">
                      <Skeleton className="h-8 w-28" />
                      <Skeleton className="h-8 w-24" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {availability.isError && (
            <div
              role="alert"
              className="rounded-xl border border-destructive/20 bg-destructive/10 p-5 text-destructive"
            >
              {getErrorMessage(availability.error)}
            </div>
          )}

          {!availability.isPending && !availability.isError && (
            <>
              {list.length === 0 ? (
                <EmptyState
                  title="Không có phòng phù hợp"
                  body="Thử giảm số khách hoặc tăng mức giá."
                />
              ) : (
                list.map((group) => {
                  const qty = selection[group.roomTypeId] ?? 0
                  const free = group.rooms.length
                  return (
                    <RoomCard
                      key={group.roomTypeId}
                      image={group.images[0] ? assetUrl(group.images[0]) : undefined}
                      name={group.name}
                      description={group.meta.description}
                      amenities={group.meta.amenities}
                      price={group.pricePerNight}
                      priceNote="/ đêm"
                      subPrice={`Tổng ${vnd(group.pricePerNight * nights)}`}
                      badge={
                        <span
                          className={cn(
                            'rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap',
                            free > 0
                              ? 'bg-success/12 text-success'
                              : 'bg-destructive/10 text-destructive',
                          )}
                        >
                          {free > 0 ? `Còn ${free} phòng` : 'Hết phòng'}
                        </span>
                      }
                      meta={
                        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Maximize2 className="size-3.5" />
                            {group.meta.size} m²
                          </span>
                          <span className="flex items-center gap-1">
                            <BedDouble className="size-3.5" />
                            {group.meta.bed}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="size-3.5" />
                            Tối đa {group.capacity}
                          </span>
                        </div>
                      }
                      actions={
                        <div className="flex gap-2">
                          <Button asChild variant="outline" className="rounded-full">
                            <Link
                              to={`/room-types/${group.roomTypeId}?checkIn=${criteria.checkIn}&checkOut=${criteria.checkOut}&guests=${criteria.guests}`}
                            >
                              Chi tiết
                            </Link>
                          </Button>
                          <Button asChild disabled={free === 0} className="rounded-full">
                            {free > 0 ? (
                              <Link
                                to={`/booking/new?checkIn=${criteria.checkIn}&checkOut=${criteria.checkOut}&guests=${criteria.guests}&rooms=${group.rooms[0].id}`}
                              >
                                Đặt ngay
                              </Link>
                            ) : (
                              <span>Đặt ngay</span>
                            )}
                          </Button>
                        </div>
                      }
                      selected={qty > 0}
                      onToggle={
                        free > 0
                          ? () => {
                              setSelection((prev) => ({
                                ...prev,
                                [group.roomTypeId]: (prev[group.roomTypeId] ?? 0) > 0 ? 0 : 1,
                              }))
                            }
                          : undefined
                      }
                      toggleLabel={`Chọn phòng ${group.name}`}
                    />
                  )
                })
              )}
            </>
          )}
        </div>
      </div>

      {selectedRoomIds.length > 0 && (
        <div className="sticky bottom-4 z-20 mt-6 rounded-2xl border border-primary/40 bg-card/95 p-5 shadow-xl backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">
                Đã chọn {selectedRoomIds.length} phòng · {nights} đêm
              </p>
              <p className="font-display text-2xl font-semibold text-foreground">
                Tạm tính {vnd(estimatedTotal)}
              </p>
              <p className="text-xs text-muted-foreground">
                Tiền cọc và tổng tiền chính thức do hệ thống xác nhận ở bước sau.
              </p>
            </div>
            <Button onClick={proceed} className="rounded-full px-6">
              Tiếp tục đặt phòng
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
