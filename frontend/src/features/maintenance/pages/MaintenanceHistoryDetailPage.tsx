import { useQuery } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { Link, useLocation, useParams } from 'react-router'
import { Button } from '@/components/atoms'
import { Alert } from '@/components/molecules'
import { PageContainer, PageHeader, Panel } from '@/components/organisms'
import { useAuth } from '@/features/auth/auth-context'
import { getErrorMessage } from '@/lib/api-client'
import { getMaintenanceHistory } from '../api'
import { HistoryTarget, HistoryStatusBadge } from '../components/HistoryPresentation'
import { historyDate } from '../history'

export function MaintenanceHistoryDetailPage() {
  const { id = '' } = useParams()
  const { me } = useAuth()
  const location = useLocation()
  const record = useQuery({
    queryKey: ['maintenance-history-detail', me?.id, id],
    queryFn: () => getMaintenanceHistory(id),
    retry: false,
  })
  const missing = isAxiosError(record.error) && record.error.response?.status === 404
  const item = record.data
  return (
    <PageContainer className="max-w-3xl">
      <PageHeader title="Chi tiết lịch sử bảo trì" />
      <div className="space-y-6">
        <Button asChild variant="outline" className="rounded-full">
          <Link to={`/operations/maintenance/history${location.search}`}>Quay lại danh sách</Link>
        </Button>
        {record.isPending && <p role="status">Đang tải bản ghi…</p>}
        {record.isError && (
          <div className="space-y-3">
            <Alert tone="danger">
              {missing
                ? 'Không tìm thấy bản ghi hoặc nằm ngoài phạm vi của bạn'
                : getErrorMessage(record.error)}
            </Alert>
            {!missing && <Button onClick={() => void record.refetch()}>Thử lại</Button>}
          </div>
        )}
        {item && (
          <>
            {item.status === 'COMPLETED' && <Alert tone="info">Bản ghi lịch sử, chỉ xem</Alert>}
            {item.status === null && (
              <Alert tone="warning">
                Không xác định được công việc liên kết. Bản ghi vẫn chỉ xem.
              </Alert>
            )}
            <Panel>
              <div className="space-y-4 text-sm">
                <HistoryStatusBadge status={item.status} />
                <dl className="grid min-w-0 grid-cols-1 gap-3 break-words sm:grid-cols-[auto_minmax(0,1fr)]">
                  <dt className="font-semibold">Đối tượng</dt>
                  <dd>
                    <HistoryTarget target={item.target} />
                  </dd>
                  {item.target.equipment && (
                    <>
                      <dt className="font-semibold">Loại / vị trí thiết bị</dt>
                      <dd>
                        {item.target.equipment.category || 'Không có'} ·{' '}
                        {item.target.equipment.location || 'Không có'}
                      </dd>
                    </>
                  )}
                  <dt className="font-semibold">Người báo cáo</dt>
                  <dd>{item.reportedBy.fullName}</dd>
                  <dt className="font-semibold">Thời điểm báo cáo</dt>
                  <dd>{historyDate(item.reportedAt)}</dd>
                  <dt className="font-semibold">Cần xử lý/bảo trì</dt>
                  <dd>{item.requiresAction ? 'Có' : 'Không'}</dd>
                  <dt className="font-semibold">Ngăn dùng phòng an toàn</dt>
                  <dd>{item.preventsSafeUse ? 'Có' : 'Không'}</dd>
                  <dt className="font-semibold">Mô tả</dt>
                  <dd className="whitespace-pre-wrap">{item.description}</dd>
                </dl>
              </div>
            </Panel>
            {item.task && (
              <Panel title="Công việc bảo trì">
                <div className="space-y-4 text-sm">
                  <p className="break-words">{item.task.title}</p>
                  <dl className="grid min-w-0 grid-cols-1 gap-3 break-words sm:grid-cols-[auto_minmax(0,1fr)]">
                    <dt className="font-semibold">Người thực hiện</dt>
                    <dd>{item.task.assignee.fullName}</dd>
                    <dt className="font-semibold">Ưu tiên</dt>
                    <dd>{item.task.priority}</dd>
                    <dt className="font-semibold">Thời điểm giao</dt>
                    <dd>{historyDate(item.task.assignedAt)}</dd>
                    <dt className="font-semibold">Hạn hoàn thành</dt>
                    <dd>{historyDate(item.task.dueAt)}</dd>
                    <dt className="font-semibold">Thời điểm hoàn thành</dt>
                    <dd>{historyDate(item.task.completedAt)}</dd>
                    <dt className="font-semibold">Kết quả công việc</dt>
                    <dd className="whitespace-pre-wrap">{item.task.workResult || 'Chưa có'}</dd>
                  </dl>
                </div>
              </Panel>
            )}
          </>
        )}
      </div>
    </PageContainer>
  )
}
