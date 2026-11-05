import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Users } from 'lucide-react'
import { RoomGallery } from '@/components/AssetImage'
import { Button, Skeleton } from '@/components/atoms'
import { EmptyState } from '@/components/molecules'
import { RoomCard, SearchBar, type SearchValue } from '@/components/organisms'
import { getErrorMessage } from '@/lib/api-client'
import { assetUrl } from '@/lib/asset-url'
import { fshort, vnd } from '@/lib/format'
import type { AvailableRoom, SearchAvailabilityParams } from '../api'
import { useAvailability } from '../hooks'
import { nightsBetween } from '../utils'

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
}

/** UC05 — Search Rooms. Guest và Customer đều dùng được (màn công khai). */
export function SearchRoomsPage() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const criteria = readCriteria(params)

  // Số phòng đã chọn theo loại, dùng để sang bước tạo booking.
  const [selection, setSelection] = useState<Record<string, number>>({})

  const availability = useAvailability(criteria)
  const nights = criteria ? nightsBetween(criteria.checkIn, criteria.checkOut) : 0

  const groups = useMemo<TypeGroup[]>(() => {
    const byType = new Map<string, AvailableRoom[]>()
    for (const room of availability.data ?? []) {
      const list = byType.get(room.roomTypeId) ?? []
      list.push(room)
      byType.set(room.roomTypeId, list)
    }
    return [...byType.entries()]
      .map(([id, rooms]) => ({
        roomTypeId: id,
        images: rooms[0]?.images ?? [],
        name: rooms[0]?.roomTypeName ?? 'Phòng',
        pricePerNight: rooms[0]?.pricePerNight ?? 0,
        capacity: rooms[0]?.capacity ?? 0,
        rooms,
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [availability.data])

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
    if (!criteria || selectedRoomIds.length === 0) return
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
      {criteria ? (
        <p className="mt-2 text-muted-foreground">
          {fshort(criteria.checkIn)} — {fshort(criteria.checkOut)} · {nights} đêm ·{' '}
          {criteria.guests} khách
        </p>
      ) : (
        <p className="mt-2 text-muted-foreground">
          Chọn ngày nhận – trả phòng và số khách để xem các loại phòng còn trống tại khách sạn.
        </p>
      )}

      <div className="mt-6">
        <SearchBar
          compact
          initial={
            criteria
              ? {
                  from: criteria.checkIn,
                  to: criteria.checkOut,
                  guests: criteria.guests,
                }
              : undefined
          }
          onSearch={handleSearch}
        />
      </div>

      {!criteria && (
        <div className="mt-10 rounded-2xl border border-border bg-card p-8 text-center text-muted-foreground">
          Nhập thông tin ở trên và bấm “Kiểm tra phòng trống” để bắt đầu.
        </div>
      )}

      {criteria && availability.isPending && (
        <div className="mt-10 grid gap-5" aria-busy="true" aria-label="Đang tìm phòng trống">
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

      {criteria && availability.isError && (
        <div
          role="alert"
          className="mt-8 rounded-xl border border-destructive/20 bg-destructive/10 p-5 text-destructive"
        >
          {getErrorMessage(availability.error)}
        </div>
      )}

      {criteria && availability.data && (
        <div className="mt-10 space-y-6">
          {availability.data.length === 0 ? (
            <EmptyState
              title="Không có phòng trống phù hợp"
              body="Vui lòng đổi ngày nhận, trả phòng hoặc số lượng khách."
            />
          ) : (
            <>
              <div className="flex flex-wrap items-end justify-between gap-2 border-b border-border pb-3">
                <h2 className="font-display text-2xl font-semibold">Loại phòng còn trống</h2>
                <p className="text-sm text-muted-foreground" aria-live="polite">
                  {nights} đêm · {availability.data.length} phòng phù hợp
                </p>
              </div>

              <div className="grid gap-5">
                {groups.map((group) => {
                  const qty = selection[group.roomTypeId] ?? 0
                  const max = group.rooms.length
                  return (
                    <RoomCard
                      key={group.roomTypeId}
                      image={group.images[0] ? assetUrl(group.images[0]) : undefined}
                      name={group.name}
                      price={group.pricePerNight}
                      priceNote="/ đêm"
                      selected={qty > 0}
                      onToggle={() => {
                        setSelection((prev) => ({
                          ...prev,
                          [group.roomTypeId]: (prev[group.roomTypeId] ?? 0) > 0 ? 0 : 1,
                        }))
                      }}
                      toggleLabel={`Chọn phòng ${group.name}`}
                      meta={
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="flex items-center gap-1">
                            <Users className="size-3.5" />
                            Tối đa {group.capacity} khách
                          </span>
                          <span className="rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success">
                            Còn {max} phòng
                          </span>
                          {group.images.length > 1 && (
                            <RoomGallery images={group.images} name={group.name} />
                          )}
                        </div>
                      }
                      actions={
                        <div className="flex flex-wrap items-center gap-3">
                          {group.rooms.length > 1 && qty > 0 && (
                            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <span>Số lượng:</span>
                              <select
                                aria-label={`Số lượng phòng ${group.name}`}
                                value={qty}
                                onChange={(e) => {
                                  const val = Number(e.target.value)
                                  setSelection((prev) => ({
                                    ...prev,
                                    [group.roomTypeId]: val,
                                  }))
                                }}
                                className="rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground"
                              >
                                {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
                                  <option key={n} value={n}>
                                    {n}
                                  </option>
                                ))}
                              </select>
                            </label>
                          )}
                          {criteria && (
                            <Link
                              to={`/room-types/${group.roomTypeId}?${new URLSearchParams({
                                checkIn: criteria.checkIn,
                                checkOut: criteria.checkOut,
                                guests: String(criteria.guests),
                              }).toString()}`}
                              className="rounded-full border border-border px-4 py-1.5 text-xs font-medium text-foreground transition hover:border-primary hover:text-primary"
                            >
                              Xem chi tiết
                            </Link>
                          )}
                        </div>
                      }
                    />
                  )
                })}
              </div>

              {selectedRoomIds.length > 0 && (
                <div className="sticky bottom-4 z-20 rounded-2xl border border-primary/40 bg-card/95 p-5 shadow-xl backdrop-blur">
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
            </>
          )}
        </div>
      )}
    </div>
  )
}
