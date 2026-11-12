import { Panel } from '@/components/organisms'
import { dateTime } from './api'
import type { StaffServiceOrder } from './staff-api'

export function IntakeDetails({ order }: { order: StaffServiceOrder }) {
  if (!order.intakeMode) return null
  return (
    <Panel title="Thông tin ghi nhận" className="min-w-0 break-words">
      <div className="space-y-2 text-sm">
        <p>
          Hình thức:{' '}
          {order.intakeMode === 'COMPLETED_ON_SITE'
            ? 'Đã thực hiện tại chỗ · chờ duyệt trước khi xác nhận hoàn thành'
            : 'Chưa thực hiện'}
        </p>
        <p>Người ghi nhận: {order.reportedByName || order.reportedBy || 'Chưa có thông tin'}</p>
        <p>Người tạo: {order.createdByName || order.createdBy || 'Chưa có thông tin'}</p>
        <p>Người yêu cầu: {order.requesterName || 'Không chỉ định'}</p>
        <p>Phòng yêu cầu: {order.roomNumber || order.roomId || 'Không chỉ định'}</p>
        <p>Thời gian yêu cầu: {dateTime(order.requestedTime)}</p>
        {order.actualPerformerId && (
          <p>Người thực hiện thực tế: {order.actualPerformerName || order.actualPerformerId}</p>
        )}
        {order.actualCompletedAt && (
          <p>Thời điểm hoàn thành thực tế: {dateTime(order.actualCompletedAt)}</p>
        )}
        {order.completionDetails && (
          <p className="whitespace-pre-wrap">Kết quả thực hiện: {order.completionDetails}</p>
        )}
      </div>
    </Panel>
  )
}
