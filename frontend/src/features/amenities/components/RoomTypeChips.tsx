import { Badge } from '@/components/atoms'
import type { AmenityRoomType } from '../api'
export function RoomTypeChips({ roomTypes }: { roomTypes: AmenityRoomType[] }) {
  if (!roomTypes.length)
    return <span className="text-muted-foreground">Chưa gắn Room Type nào</span>
  const chip = (type: AmenityRoomType) => (
    <Badge
      key={type.id}
      tone="neutral"
      className="h-auto max-w-full min-w-0 break-words whitespace-normal"
    >
      <span className="min-w-0 break-words">
        {type.name}
        {type.isActive ? '' : ' (ngừng)'}
      </span>
    </Badge>
  )
  return (
    <div className="flex flex-wrap gap-2">
      {roomTypes.slice(0, 3).map(chip)}
      {roomTypes.length > 3 && (
        <details>
          <summary className="flex min-h-11 cursor-pointer items-center text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring">
            +{roomTypes.length - 3} loại phòng
          </summary>
          <div className="flex flex-wrap gap-2">{roomTypes.slice(3).map(chip)}</div>
        </details>
      )}
    </div>
  )
}
