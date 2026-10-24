import { isAxiosError } from 'axios'
import { Button } from '@/components/Button'
export function StaffOrderError({ error, retry }: { error: unknown; retry?: () => void }) {
  const status = isAxiosError(error) ? error.response?.status : undefined
  const message =
    status === 403
      ? 'Bạn không có quyền sử dụng chức năng này.'
      : status === 404
        ? 'Không tìm thấy yêu cầu dịch vụ.'
        : status === 409
          ? 'Dữ liệu đã thay đổi. Đã yêu cầu tải lại trạng thái; nội dung duyệt đã gửi được giữ nguyên.'
          : status === 503
            ? 'Chờ hoàn tất ghi phí, chưa xác nhận chấp nhận. Tải lại trạng thái và thử lại đúng nội dung đã gửi.'
            : 'Không thể tải hoặc xử lý yêu cầu. Kiểm tra trạng thái mới nhất trước khi thử lại cùng nội dung.'
  return (
    <div role="alert" className="my-4 space-y-2 rounded border border-danger p-4 text-danger">
      <p>{message}</p>
      {retry && (
        <Button variant="secondary" onClick={retry}>
          Tải lại trạng thái
        </Button>
      )}
    </div>
  )
}
