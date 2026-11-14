import { isAxiosError } from 'axios'
import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/atoms'
import { Alert } from '@/components/molecules'
import { Panel } from '@/components/organisms'
import {
  money,
  dateTime,
  reviewLabels,
  executionLabels,
  serviceOrderState,
  type ServiceOrder,
} from './api'

export function OrderBusinessState({ order }: { order: ServiceOrder }) {
  const status = serviceOrderState(order)
  return (
    <p className={status.tone === 'success' ? 'font-medium text-success' : 'text-muted-foreground'}>
      Trạng thái yêu cầu: {status.label}
    </p>
  )
}

export function OrderError({
  error,
  retry,
  presentation,
}: {
  error: unknown
  retry?: () => void
  presentation?: 'workspace'
}) {
  const status = isAxiosError(error) ? error.response?.status : undefined
  const message =
    status === 403
      ? 'Bạn không có quyền sử dụng chức năng này.'
      : status === 404
        ? 'Không tìm thấy yêu cầu hoặc dữ liệu không thuộc tài khoản của bạn.'
        : status === 409
          ? 'Đặt phòng chưa được xác nhận hoặc không còn nhận dịch vụ, hoặc dữ liệu yêu cầu đã thay đổi. Vui lòng tải lại lựa chọn và kiểm tra trước khi gửi.'
          : status === 400
            ? 'Thông tin không hợp lệ. Vui lòng kiểm tra lựa chọn, số lượng và ghi chú.'
            : 'Không thể kết nối hoặc tải dữ liệu. Vui lòng thử lại; gửi lại cùng nội dung sẽ dùng cùng mã yêu cầu để tránh trùng lặp.'
  if (presentation === 'workspace')
    return (
      <Alert tone="danger" className="my-4">
        <p>{message}</p>
        {retry && (
          <Button type="button" variant="link" className="mt-2" onClick={retry}>
            Thử lại
          </Button>
        )}
      </Alert>
    )
  return (
    <div role="alert" className="my-4 rounded border border-danger p-4 text-danger">
      <p>{message}</p>
      {retry && (
        <button type="button" className="mt-2 min-h-11 underline" onClick={retry}>
          Thử lại
        </button>
      )}
    </div>
  )
}
export function OrderReceipt({
  order,
  presentation,
}: {
  order: ServiceOrder & { intakeMode?: string }
  presentation?: 'workspace'
}) {
  const Container = presentation === 'workspace' ? Panel : 'div'
  return (
    <Container
      className={
        presentation === 'workspace'
          ? 'min-w-0 break-words'
          : 'space-y-4 rounded border border-border bg-card p-4 break-words sm:p-6'
      }
    >
      <div className="space-y-4">
        <h2
          className={
            presentation === 'workspace' ? 'text-sm font-semibold' : 'font-display text-2xl'
          }
        >
          {order.service.name}
        </h2>
        <OrderBusinessState order={order} />
        {(order.reviewStatus === 'REJECTED' || order.reviewStatus === 'ABANDONED') && (
          <p className="text-sm break-words whitespace-pre-wrap text-muted-foreground">
            Lý do từ chối: {order.reviewReason?.trim() || 'Không có lý do từ chối.'}
          </p>
        )}
        <dl className="grid gap-4 sm:grid-cols-2">
          {[
            ['Mã đặt phòng', order.bookingCode?.trim() || 'Không còn thông tin đặt phòng'],
            ['Phòng', order.roomNumbers?.join(', ') || 'Chưa có thông tin phòng'],
            ['Số lượng', `${order.quantity} ${order.service.unit}`],
            ['Đơn giá ghi nhận', money(order.unitPriceVND)],
            ['Thành tiền ghi nhận từ máy chủ', money(order.amount)],
            ...(order.intakeMode === 'COMPLETED_ON_SITE'
              ? []
              : [['Thời gian yêu cầu', dateTime(order.requestedTime)]]),
            ['Trạng thái duyệt', reviewLabels[order.reviewStatus] ?? 'Chưa xác định'],
            ['Trạng thái thực hiện', executionLabels[order.executionStatus] ?? 'Chưa xác định'],
            ['Ngày tạo', dateTime(order.createdAt)],
            ['Ghi chú', order.notes || 'Không có'],
          ].map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-sm text-muted-foreground">{label}</dt>
              <dd className="mt-1 whitespace-pre-wrap">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="text-sm text-muted-foreground">
          {serviceOrderState(order).state === 'UNKNOWN'
            ? 'Chưa xác định trạng thái yêu cầu. Vui lòng tải lại để kiểm tra.'
            : serviceOrderState(order).state === 'PROCESSING'
              ? order.reviewStatus === 'ACCEPTING'
                ? 'Đang xử lý chấp nhận, chờ hoàn tất ghi phí; chưa được chấp nhận.'
                : 'Đang xử lý phân công; chưa xác nhận đã phân công.'
              : order.reviewStatus === 'PENDING_REVIEW'
                ? 'Yêu cầu đang chờ duyệt, chưa được chấp nhận và chưa ghi thu phí.'
                : order.reviewStatus === 'ABANDONED'
                  ? 'Yêu cầu đã dừng kỹ thuật do lịch dịch vụ đã qua, không ghi phí và không tạo công việc. Không phải từ chối thông thường.'
                  : order.reviewStatus === 'REJECTED'
                    ? 'Yêu cầu đã bị từ chối.'
                    : 'Yêu cầu đã được chấp nhận. Trạng thái này không xác nhận đã thanh toán.'}
        </p>
      </div>
    </Container>
  )
}
export function OrderNavigation({ variant = 'both' }: { variant?: 'both' | 'back' } = {}) {
  if (variant === 'back') {
    return (
      <nav className="mb-6">
        <Link
          to="/customer/service-orders/history"
          className="inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Dịch vụ của tôi
        </Link>
      </nav>
    )
  }
  return (
    <nav className="mb-6 flex flex-wrap gap-4 text-primary">
      <Link
        className="inline-flex min-h-11 items-center underline"
        to="/customer/service-orders/history"
      >
        Dịch vụ của tôi
      </Link>
      <Link
        className="inline-flex min-h-11 items-center underline"
        to="/customer/service-orders/new"
      >
        Yêu cầu dịch vụ
      </Link>
    </nav>
  )
}
