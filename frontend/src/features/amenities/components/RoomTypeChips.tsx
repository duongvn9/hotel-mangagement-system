import { Badge } from '@/components/Badge'
import type { AmenityRoomType } from '../api'
export function RoomTypeChips({ roomTypes }: { roomTypes: AmenityRoomType[] }) {
  if (!roomTypes.length) return <span className="text-stone-700">Chưa gắn Room Type nào</span>
  const chip = (type: AmenityRoomType) => (
    <Badge key={type.id} tone="neutral">
      {type.name}
      {type.isActive ? '' : ' (ngừng)'}
    </Badge>
  )
  return (
    <div className="flex flex-wrap gap-2">
      {roomTypes.slice(0, 3).map(chip)}
      {roomTypes.length > 3 && (
        <details>
          <summary className="flex min-h-11 cursor-pointer items-center text-primary hover:underline">
            +{roomTypes.length - 3} loại phòng
          </summary>
          <div className="flex flex-wrap gap-2">{roomTypes.slice(3).map(chip)}</div>
        </details>
      )}
    </div>
  )
}
