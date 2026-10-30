import { useMemo, useState } from 'react'
import { Alert } from '@/components/Alert'
import { Badge } from '@/components/Badge'
import { SelectField } from '@/components/SelectField'
import { TextField } from '@/components/TextField'
import { getErrorMessage } from '@/lib/api-client'
import type { RoomBoardEntry, RoomOccupancy } from '../api'
import { useRoomStatusBoard } from '../hooks'
import { formatDate, todayISO } from '../utils'

type Tone = 'success' | 'info' | 'warning' | 'danger' | 'neutral'

const OCCUPANCY_DISPLAY: Record<RoomOccupancy, { label: string; tone: Tone }> = {
  FREE: { label: 'Trống', tone: 'success' },
  HELD: { label: 'Giữ chỗ', tone: 'warning' },
  RESERVED: { label: 'Đã đặt', tone: 'info' },
  IN_HOUSE: { label: 'Đang ở', tone: 'danger' },
}

const PHYSICAL_DISPLAY: Record<string, { label: string; tone: Tone }> = {
  MAINTENANCE: { label: 'Bảo trì', tone: 'neutral' },
  CLEANING: { label: 'Đang dọn', tone: 'warning' },
  OCCUPIED: { label: 'Có khách', tone: 'neutral' },
}

/** UC13 — View Room Availability & Status Board. Lễ tân/Quản lý xem tình trạng từng phòng theo ngày. */
export function RoomStatusBoardPage() {
  const [date, setDate] = useState(todayISO())
  const [floor, setFloor] = useState('')
  const [roomTypeId, setRoomTypeId] = useState('')
  const board = useRoomStatusBoard({ date })

  const rooms = board.data?.rooms
  const floorOptions = useMemo(
    () => [
      { value: '', label: 'Tất cả' },
      ...[...new Set((rooms ?? []).map((room) => room.floor))]
        .sort((a, b) => a - b)
        .map((value) => ({ value: String(value), label: `Tầng ${value}` })),
    ],
    [rooms],
  )
  const typeOptions = useMemo(() => {
    const names = new Map((rooms ?? []).map((room) => [room.roomTypeId, room.roomTypeName]))
    return [
      { value: '', label: 'Tất cả' },
      ...[...names].map(([value, label]) => ({ value, label: label || 'Chưa rõ loại' })),
    ]
  }, [rooms])

  const floors = useMemo(() => {
    const visible = (rooms ?? []).filter(
      (room) =>
        (floor === '' || room.floor === Number(floor)) &&
        (roomTypeId === '' || room.roomTypeId === roomTypeId),
    )
    const byFloor = new Map<number, RoomBoardEntry[]>()
    for (const room of visible) byFloor.set(room.floor, [...(byFloor.get(room.floor) ?? []), room])
    return [...byFloor.entries()].sort(([a], [b]) => a - b)
  }, [rooms, floor, roomTypeId])

  const summary = board.data?.summary
  const chips = summary
    ? [
        { label: 'Trống', count: summary.free },
        { label: 'Giữ chỗ', count: summary.held },
        { label: 'Đã đặt', count: summary.reserved },
        { label: 'Đang ở', count: summary.inHouse },
        { label: 'Bảo trì', count: summary.maintenance },
        { label: 'Đang dọn', count: summary.cleaning },
      ]
    : []

  return (
    <section className="mx-auto max-w-container space-y-6 px-4 py-10 font-body">
      <div>
        <p className="text-xs font-semibold tracking-widest text-primary uppercase">Lễ tân</p>
        <h1 className="font-display text-4xl font-semibold text-pearl-900">Sơ đồ phòng</h1>
        {board.data && (
          <p className="mt-2 text-sm text-stone-700">
            Tình trạng phòng ngày {formatDate(board.data.date)}
          </p>
        )}
      </div>

      <div className="grid gap-4 rounded-lg border border-stone-300 bg-white p-6 md:grid-cols-3">
        <TextField
          label="Ngày"
          type="date"
          required
          value={date}
          onChange={(event) => event.target.value && setDate(event.target.value)}
        />
        <SelectField
          label="Tầng"
          options={floorOptions}
          value={floor}
          onChange={(event) => setFloor(event.target.value)}
        />
        <SelectField
          label="Loại phòng"
          options={typeOptions}
          value={roomTypeId}
          onChange={(event) => setRoomTypeId(event.target.value)}
        />
      </div>

      {board.isError && <Alert tone="danger">{getErrorMessage(board.error)}</Alert>}

      {board.isPending ? (
        <p className="text-stone-700">Đang tải…</p>
      ) : (
        board.data && (
          <>
            <ul aria-label="Tổng hợp" className="flex flex-wrap gap-2">
              {chips.map((chip) => (
                <li
                  key={chip.label}
                  className="rounded-full border border-stone-300 bg-white px-3 py-1 text-xs font-semibold text-stone-700"
                >
                  {chip.label}: {chip.count}
                </li>
              ))}
            </ul>

            {floors.length === 0 ? (
              <p className="rounded-lg border border-stone-300 bg-white p-6 text-stone-700">
                Không có phòng nào để hiển thị.
              </p>
            ) : (
              floors.map(([floorNumber, floorRooms]) => (
                <div key={floorNumber} className="space-y-3">
                  <h2 className="font-display text-xl font-semibold text-pearl-900">
                    Tầng {floorNumber}
                  </h2>
                  <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {floorRooms.map((room) => (
                      <RoomCard key={room.id} room={room} />
                    ))}
                  </ul>
                </div>
              ))
            )}
          </>
        )
      )}
    </section>
  )
}

function RoomCard({ room }: { room: RoomBoardEntry }) {
  const occupancy = OCCUPANCY_DISPLAY[room.occupancy]
  const physical = room.physicalStatus ? PHYSICAL_DISPLAY[room.physicalStatus] : undefined
  return (
    <li
      aria-label={`Phòng ${room.roomNumber}`}
      className="space-y-2 rounded-lg border border-stone-300 bg-white p-4"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-2xl font-semibold text-pearl-900 tabular-nums">{room.roomNumber}</p>
          <p className="text-xs text-stone-700">
            {room.roomTypeName} · {room.capacity} khách
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge tone={occupancy.tone}>{occupancy.label}</Badge>
          {physical && <Badge tone={physical.tone}>{physical.label}</Badge>}
        </div>
      </div>
      {room.booking && (
        <div className="space-y-0.5 border-t border-stone-200 pt-2 text-sm">
          <p className="font-semibold tracking-wide text-pearl-900">{room.booking.code}</p>
          <p className="text-stone-700">{room.booking.guestName}</p>
          <p className="text-xs text-stone-500">
            {formatDate(room.booking.checkIn)} – {formatDate(room.booking.checkOut)}
          </p>
        </div>
      )}
    </li>
  )
}
