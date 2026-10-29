import { isAxiosError } from 'axios'
import { Link } from 'react-router'
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
    <p className={status.tone === 'success' ? 'font-medium text-success' : 'text-stone-700'}>
      Trạng thái yêu cầu: {status.label}
    </p>
  )
}

export function OrderError({ error, retry }: { error: unknown; retry?: () => void }) {
  const status = isAxiosError(error) ? error.response?.status : undefined
  const message =
    status === 403
      ? 'Bạn không có quyền sử dụng chức năng này.'
      : status === 404
        ? 'Không tìm thấy yêu cầu hoặc dữ liệu không thuộc tài khoản của bạn.'
        : status === 409
          ? 'Đặt phòng không còn ở trạng thái đã nhận phòng hoặc dữ liệu yêu cầu đã thay đổi. Vui lòng tải lại lựa chọn và kiểm tra trước khi gửi.'
          : status === 400
            ? 'Thông tin không hợp lệ. Vui lòng kiểm tra lựa chọn, số lượng và ghi chú.'
            : 'Không thể kết nối hoặc tải dữ liệu. Vui lòng thử lại; gửi lại cùng nội dung sẽ dùng cùng mã yêu cầu để tránh trùng lặp.'
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
export function OrderReceipt({ order }: { order: ServiceOrder }) {
  return (
    <div className="space-y-4 rounded border border-stone-300 bg-white p-4 break-words sm:p-6">
      <h2 className="font-display text-2xl">{order.service.name}</h2>
      <OrderBusinessState order={order} />
      <dl className="grid gap-4 sm:grid-cols-2">
        {[
          ['Mã yêu cầu', order.id],
          ['Mã đặt phòng', order.bookingId],
          ['Số lượng', `${order.quantity} ${order.service.unit}`],
          ['Đơn giá ghi nhận', money(order.unitPriceVND)],
          ['Thành tiền ghi nhận từ máy chủ', money(order.amount)],
          ['Thời gian yêu cầu', dateTime(order.requestedTime)],
          ['Trạng thái duyệt', reviewLabels[order.reviewStatus] ?? order.reviewStatus],
          ['Trạng thái thực hiện', executionLabels[order.executionStatus] ?? order.executionStatus],
          ['Ngày tạo', dateTime(order.createdAt)],
          ['Ghi chú', order.notes || 'Không có'],
        ].map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-sm text-stone-700">{label}</dt>
            <dd className="mt-1 whitespace-pre-wrap">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-sm text-stone-700">
        {serviceOrderState(order).state === 'UNKNOWN'
          ? 'Chưa xác định trạng thái yêu cầu. Vui lòng tải lại để kiểm tra.'
          : serviceOrderState(order).state === 'PROCESSING'
            ? order.reviewStatus === 'ACCEPTING'
              ? 'Đang xử lý chấp nhận, chờ hoàn tất ghi phí; chưa được chấp nhận.'
              : 'Đang xử lý phân công; chưa xác nhận đã phân công.'
            : order.reviewStatus === 'PENDING_REVIEW'
              ? 'Yêu cầu đang chờ duyệt, chưa được chấp nhận và chưa ghi thu phí.'
              : order.reviewStatus === 'REJECTED'
                ? 'Yêu cầu đã bị từ chối.'
                : 'Yêu cầu đã được chấp nhận. Trạng thái này không xác nhận đã thanh toán.'}
      </p>
    </div>
  )
}
export function OrderNavigation() {
  return (
    <nav className="mb-6 flex flex-wrap gap-4 text-primary">
      <Link className="inline-flex min-h-11 items-center underline" to="/customer/service-orders">
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
