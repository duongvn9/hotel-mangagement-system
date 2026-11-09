import { AssetImage } from '@/components/AssetImage'
import { Badge } from '@/components/atoms'
import type { HistoryItem, HistoryStatus } from '../api'

import { HISTORY_LABELS } from '../history'
export function HistoryStatusBadge({ status }: { status: HistoryStatus }) {
  return (
    <Badge
      tone={
        status === 'COMPLETED'
          ? 'success'
          : status === 'IN_PROGRESS'
            ? 'warning'
            : status === 'ASSIGNED'
              ? 'info'
              : 'neutral'
      }
    >
      <span>{status ? HISTORY_LABELS[status] : 'Không xác định'}</span>
    </Badge>
  )
}
export function HistoryTarget({ target }: { target: HistoryItem['target'] }) {
  return (
    <div className="min-w-0 space-y-1 break-words">
      {target.room && (
        <p>
          Phòng {target.room.roomNumber} · tầng {target.room.floor}
        </p>
      )}
      {target.equipment && (
        <p>
          <AssetImage decorative path={target.equipment.imageUrl} name={target.equipment.name} />
          {target.equipment.assetCode} — {target.equipment.name}
        </p>
      )}
      {target.facilityLocation && <p>{target.facilityLocation}</p>}
      {!target.room && !target.equipment && !target.facilityLocation && (
        <p>Đối tượng không còn tồn tại</p>
      )}
    </div>
  )
}
