import { useMemo, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { Alert } from '@/components/Alert'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { SelectField } from '@/components/SelectField'
import { TextField } from '@/components/TextField'
import { getErrorMessage } from '@/lib/api-client'
import type { RoomType } from '@/features/room-types/api'
import type { AvailableRoom, SearchAvailabilityParams } from '../api'
import { useAvailability, useBookableRoomTypes } from '../hooks'
import { money, nightsBetween, todayISO } from '../utils'

/** Đọc tiêu chí hợp lệ từ URL để chạy UC05; trả null khi chưa đủ/không hợp lệ. */
function readCriteria(params: URLSearchParams): SearchAvailabilityParams | null {
  const checkIn = params.get('checkIn') ?? ''
  const checkOut = params.get('checkOut') ?? ''
  const guests = Number(params.get('guests'))
  const roomTypeId = params.get('roomTypeId') || undefined
  const valid =
    /^\d{4}-\d{2}-\d{2}$/.test(checkIn) &&
    /^\d{4}-\d{2}-\d{2}$/.test(checkOut) &&
    nightsBetween(checkIn, checkOut) > 0 &&
    Number.isInteger(guests) &&
    guests >= 1
  if (!valid) return null
  return { checkIn, checkOut, guests, ...(roomTypeId ? { roomTypeId } : {}) }
}

interface TypeGroup {
  type: RoomType | undefined
  roomTypeId: string
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
  const [roomTypeId, setRoomTypeId] = useState(params.get('roomTypeId') ?? '')
  const [formError, setFormError] = useState('')

  // Số phòng đã chọn theo loại, dùng để sang bước tạo booking.
  const [selection, setSelection] = useState<Record<string, number>>({})

  const types = useBookableRoomTypes()
  const availability = useAvailability(criteria)
  const nights = criteria ? nightsBetween(criteria.checkIn, criteria.checkOut) : 0

  const typeMap = useMemo(
    () => new Map((types.data ?? []).map((type) => [type.id, type])),
    [types.data],
  )

  const groups = useMemo<TypeGroup[]>(() => {
    const byType = new Map<string, AvailableRoom[]>()
    for (const room of availability.data ?? []) {
      const list = byType.get(room.roomTypeId) ?? []
      list.push(room)
      byType.set(room.roomTypeId, list)
    }
    return [...byType.entries()]
      .map(([id, rooms]) => ({ roomTypeId: id, rooms, type: typeMap.get(id) }))
      .sort((a, b) => (a.type?.name ?? '').localeCompare(b.type?.name ?? ''))
  }, [availability.data, typeMap])

  const selectedRoomIds = useMemo(
    () =>
      groups.flatMap((group) =>
        group.rooms.slice(0, selection[group.roomTypeId] ?? 0).map((r) => r.id),
      ),
    [groups, selection],
  )

  const estimatedTotal = useMemo(
    () =>
      groups.reduce(
        (sum, group) =>
          sum + (selection[group.roomTypeId] ?? 0) * (group.type?.basePrice ?? 0) * nights,
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
    const next: Record<string, string> = { checkIn, checkOut, guests: String(Number(guests)) }
    if (roomTypeId) next.roomTypeId = roomTypeId
    setParams(next)
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
        <p className="text-xs font-semibold tracking-widest text-primary uppercase">Đặt phòng</p>
        <h1 className="font-display text-4xl font-semibold text-pearl-900">Tìm phòng trống</h1>
        <p className="mt-2 text-sm text-stone-700">
          Chọn ngày nhận – trả phòng và số khách để xem các phòng còn trống.
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
        <SelectField
          label="Loại phòng"
          value={roomTypeId}
          options={[
            { value: '', label: 'Tất cả' },
            ...(types.data ?? []).map((type) => ({ value: type.id, label: type.name })),
          ]}
          onChange={(event) => setRoomTypeId(event.target.value)}
        />
        <div className="md:col-span-4">
          <Button type="submit">Tìm phòng</Button>
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
          <p className="text-sm text-stone-700" aria-live="polite">
            {availability.data.length === 0
              ? 'Không có phòng trống phù hợp. Vui lòng đổi ngày hoặc số khách.'
              : `${nights} đêm · ${availability.data.length} phòng trống phù hợp.`}
          </p>

          {groups.map((group) => {
            const qty = selection[group.roomTypeId] ?? 0
            const max = group.rooms.length
            return (
              <article
                key={group.roomTypeId}
                className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-stone-300 bg-white p-5"
              >
                <div className="min-w-56 space-y-1">
                  <div className="flex items-center gap-2">
                    <h2 className="font-display text-xl font-semibold text-pearl-900">
                      {group.type?.name ?? 'Phòng'}
                    </h2>
                    <Badge tone="success">Còn {max} phòng</Badge>
                  </div>
                  {group.type?.description && (
                    <p className="max-w-prose text-sm text-stone-700">{group.type.description}</p>
                  )}
                  <p className="text-sm text-stone-700">
                    Sức chứa tối đa {group.rooms[0]?.capacity} khách/phòng
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-display text-lg font-semibold text-pearl-900">
                    {group.type ? money.format(group.type.basePrice) : '—'}
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
              </article>
            )
          })}

          {selectedRoomIds.length > 0 && (
            <div className="sticky bottom-4 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-primary bg-cream-50 p-5">
              <div>
                <p className="text-sm text-stone-700">
                  Đã chọn {selectedRoomIds.length} phòng · {nights} đêm
                </p>
                <p className="font-display text-xl font-semibold text-pearl-900">
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
