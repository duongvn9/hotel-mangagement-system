import { useMemo, useState } from 'react'
import { Badge, Input, NativeSelect } from '@/components/atoms'
import { Alert, FormField } from '@/components/molecules'
import { PageContainer, PageHeader, Panel } from '@/components/organisms'
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
    <PageContainer className="space-y-6">
      <PageHeader
        eyebrow="Lễ tân"
        title="Sơ đồ phòng"
        subtitle={
          board.data
            ? `Tình trạng phòng ngày ${formatDate(board.data.date)}`
            : 'Tình trạng từng phòng theo ngày.'
        }
      />

      <div className="card-soft grid gap-4 p-5 sm:p-6 md:grid-cols-3">
        <FormField label="Ngày" htmlFor="room-board-date" required>
          <Input
            id="room-board-date"
            type="date"
            required
            value={date}
            onChange={(event) => event.target.value && setDate(event.target.value)}
          />
        </FormField>
        <FormField label="Tầng" htmlFor="room-board-floor">
          <NativeSelect
            id="room-board-floor"
            value={floor}
            onChange={(event) => setFloor(event.target.value)}
          >
            {floorOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField label="Loại phòng" htmlFor="room-board-type">
          <NativeSelect
            id="room-board-type"
            value={roomTypeId}
            onChange={(event) => setRoomTypeId(event.target.value)}
          >
            {typeOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </NativeSelect>
        </FormField>
      </div>

      {board.isError && <Alert tone="danger">{getErrorMessage(board.error)}</Alert>}

      {board.isPending ? (
        <p className="text-sm text-muted-foreground">Đang tải…</p>
      ) : (
        board.data && (
          <>
            <ul aria-label="Tổng hợp" className="flex flex-wrap gap-2">
              {chips.map((chip) => (
                <li
                  key={chip.label}
                  className="inline-flex items-center rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground shadow-sm"
                >
                  {chip.label}: {chip.count}
                </li>
              ))}
            </ul>

            {floors.length === 0 ? (
              <Panel>
                <p className="text-sm text-muted-foreground">Không có phòng nào để hiển thị.</p>
              </Panel>
            ) : (
              floors.map(([floorNumber, floorRooms]) => (
                <div key={floorNumber} className="space-y-3">
                  <h2 className="font-display text-xl font-semibold text-foreground">
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
    </PageContainer>
  )
}

function RoomCard({ room }: { room: RoomBoardEntry }) {
  const occupancy = OCCUPANCY_DISPLAY[room.occupancy]
  const physical = room.physicalStatus ? PHYSICAL_DISPLAY[room.physicalStatus] : undefined
  return (
    <li
      aria-label={`Phòng ${room.roomNumber}`}
      className="card-soft space-y-2 p-4 transition-colors hover:shadow-lift"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-2xl font-semibold tabular-nums text-foreground">{room.roomNumber}</p>
          <p className="text-xs text-muted-foreground">
            {room.roomTypeName} · {room.capacity} khách
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge tone={occupancy.tone}>{occupancy.label}</Badge>
          {physical && <Badge tone={physical.tone}>{physical.label}</Badge>}
        </div>
      </div>
      {room.booking && (
        <div className="space-y-0.5 border-t border-border pt-2 text-sm">
          <p className="font-semibold tracking-wide text-foreground">{room.booking.code}</p>
          <p className="text-muted-foreground">{room.booking.guestName}</p>
          <p className="text-xs text-muted-foreground">
            {formatDate(room.booking.checkIn)} – {formatDate(room.booking.checkOut)}
          </p>
        </div>
      )}
    </li>
  )
}
