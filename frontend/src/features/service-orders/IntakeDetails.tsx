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
            ? order.reviewStatus === 'ACCEPTED'
              ? 'Đã thực hiện tại chỗ · đã được duyệt'
              : 'Đã thực hiện tại chỗ · chưa được chấp nhận'
            : 'Chưa thực hiện'}
        </p>
        <p>Người ghi nhận: {order.reportedByName || order.reportedBy || 'Chưa có thông tin'}</p>
        <p>Người tạo: {order.createdByName || order.createdBy || 'Chưa có thông tin'}</p>
        <p>Người yêu cầu: {order.requesterName || 'Không chỉ định'}</p>
        <p>Phòng yêu cầu: {order.roomNumber || order.roomId || 'Không chỉ định'}</p>
        <p>Thời điểm ghi nhận: {dateTime(order.createdAt)}</p>
        {order.intakeMode === 'COMPLETED_ON_SITE' ? (
          <p>Không tạo công việc phân công</p>
        ) : (
          <p>Thời gian yêu cầu: {dateTime(order.requestedTime)}</p>
        )}
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
