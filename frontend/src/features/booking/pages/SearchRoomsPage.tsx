import { useMemo, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { Alert } from '@/components/Alert'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { SelectField } from '@/components/SelectField'
import { TextField } from '@/components/TextField'
import { getErrorMessage } from '@/lib/api-client'
import { env } from '@/lib/env'
import type { AvailableRoom, SearchAvailabilityParams } from '../api'
import { useAvailability } from '../hooks'
import { BedIcon, ClockIcon, UsersIcon } from '../icons'
import { money, nightsBetween, todayISO } from '../utils'

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

  // Form nhập độc lập với URL để người dùng sửa trước khi tìm.
  const [checkIn, setCheckIn] = useState(params.get('checkIn') ?? '')
  const [checkOut, setCheckOut] = useState(params.get('checkOut') ?? '')
  const [guests, setGuests] = useState(params.get('guests') ?? '2')
  const [formError, setFormError] = useState('')

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

  function submitSearch(event: FormEvent) {
    event.preventDefault()
    setFormError('')
    if (nightsBetween(checkIn, checkOut) <= 0) {
      setFormError('Ngày trả phòng phải sau ngày nhận phòng.')
      return
    }
    if (!(Number(guests) >= 1)) {
      setFormError('Số khách phải từ 1 trở lên.')
      return
    }
    setSelection({})
    setParams({ checkIn, checkOut, guests: String(Number(guests)) })
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
    <section className="mx-auto max-w-container space-y-6 px-4 py-10 font-body">
      <div>
        <p className="text-xs font-semibold tracking-widest text-primary uppercase">
          {env.appName}
        </p>
        <h1 className="font-display text-4xl font-semibold text-pearl-900">Đặt phòng</h1>
        <p className="mt-2 text-sm text-stone-700">
          Chọn ngày nhận – trả phòng và số khách để xem các loại phòng còn trống tại khách sạn.
        </p>
      </div>

      <form
        onSubmit={submitSearch}
        className="grid gap-4 rounded-lg border border-stone-300 bg-white p-6 md:grid-cols-4"
        aria-label="Tìm phòng trống"
      >
        <TextField
          label="Nhận phòng"
          type="date"
          required
          min={todayISO()}
          value={checkIn}
          onChange={(event) => setCheckIn(event.target.value)}
        />
        <TextField
          label="Trả phòng"
          type="date"
          required
          min={checkIn || todayISO()}
          value={checkOut}
          onChange={(event) => setCheckOut(event.target.value)}
        />
        <TextField
          label="Số khách"
          type="number"
          min={1}
          max={20}
          required
          value={guests}
          onChange={(event) => setGuests(event.target.value)}
        />
        <div className="flex items-end">
          <Button type="submit" className="w-full">
            Tìm phòng
          </Button>
        </div>
      </form>

      {formError && <Alert tone="danger">{formError}</Alert>}

      {!criteria && !formError && (
        <p className="rounded-lg border border-stone-300 bg-white p-6 text-stone-700">
          Nhập thông tin ở trên và bấm “Tìm phòng” để bắt đầu.
        </p>
      )}

      {criteria && availability.isPending && <p role="status">Đang tìm phòng trống…</p>}

      {criteria && availability.isError && (
        <Alert tone="danger">{getErrorMessage(availability.error)}</Alert>
      )}

      {criteria && availability.data && (
        <div className="space-y-4">
          {availability.data.length === 0 ? (
            <p
              className="rounded-lg border border-stone-300 bg-white p-6 text-stone-700"
              aria-live="polite"
            >
              Không có phòng trống phù hợp. Vui lòng đổi ngày hoặc số khách.
            </p>
          ) : (
            <div className="flex flex-wrap items-end justify-between gap-2 border-b border-stone-300 pb-2">
              <h2 className="font-display text-2xl font-semibold text-pearl-900">
                Loại phòng còn trống
              </h2>
              <p className="text-sm text-stone-700" aria-live="polite">
                {nights} đêm · {availability.data.length} phòng phù hợp
              </p>
            </div>
          )}

          {groups.map((group) => {
            const qty = selection[group.roomTypeId] ?? 0
            const max = group.rooms.length
            return (
              <article
                key={group.roomTypeId}
                className="overflow-hidden rounded-xl border border-stone-300 bg-white shadow-sm sm:flex"
              >
                <div className="relative flex h-32 items-center justify-center bg-gradient-to-br from-cream-100 to-brandy-100 sm:h-auto sm:w-44 sm:shrink-0">
                  <BedIcon className="size-10 text-primary/60" />
                  <span className="absolute top-3 left-3">
                    <Badge tone="success">Còn {max} phòng</Badge>
                  </span>
                </div>
                <div className="flex flex-1 flex-wrap items-center justify-between gap-4 p-5">
                  <div className="min-w-48 space-y-2">
                    <div>
                      <p className="text-[11px] font-semibold tracking-widest text-primary uppercase">
                        Loại phòng
                      </p>
                      <h3 className="font-display text-xl font-semibold text-pearl-900">
                        {group.name}
                      </h3>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-stone-700">
                      <span className="inline-flex items-center gap-1.5">
                        <UsersIcon className="size-4 text-primary" /> Tối đa {group.capacity} khách
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <ClockIcon className="size-4 text-primary" /> Giữ phòng 15 phút
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-semibold text-pearl-900 tabular-nums">
                      {group.pricePerNight ? money.format(group.pricePerNight) : '—'}
                    </p>
                    <p className="text-xs text-stone-700">mỗi đêm</p>
                  </div>
                  <SelectField
                    label="Số phòng"
                    className="w-28"
                    value={String(qty)}
                    options={Array.from({ length: max + 1 }, (_, n) => ({
                      value: String(n),
                      label: String(n),
                    }))}
                    onChange={(event) =>
                      setSelection((previous) => ({
                        ...previous,
                        [group.roomTypeId]: Number(event.target.value),
                      }))
                    }
                  />
                </div>
              </article>
            )
          })}

          {selectedRoomIds.length > 0 && (
            <div className="sticky bottom-4 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-primary bg-cream-50 p-5">
              <div>
                <p className="text-sm text-stone-700">
                  Đã chọn {selectedRoomIds.length} phòng · {nights} đêm
                </p>
                <p className="text-xl font-semibold text-pearl-900 tabular-nums">
                  Tạm tính {money.format(estimatedTotal)}
                </p>
                <p className="text-xs text-stone-700">
                  Tiền cọc và tổng tiền chính thức do hệ thống xác nhận ở bước sau.
                </p>
              </div>
              <Button onClick={proceed}>Tiếp tục đặt phòng</Button>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
