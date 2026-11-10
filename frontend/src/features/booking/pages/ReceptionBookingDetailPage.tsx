import { Pencil } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { Button } from '@/components/atoms'
import { Alert, EmptyState } from '@/components/molecules'
import { PageContainer } from '@/components/organisms'
import { getErrorMessage } from '@/lib/api-client'
import { useBookingList, useBookingSummary } from '../hooks'
import { BookingDetailLayout } from '../components/BookingDetailLayout'

/** Trạng thái còn sửa được (UC11): trước khi nhận phòng và chưa huỷ. */
const EDITABLE_STATUSES = ['PENDING_DEPOSIT', 'CONFIRMED']

/**
 * UC09 — View Booking Detail (bản cho Lễ tân/Quản lý), theo màn app.bookings.$id của prototype
 * (BookingDetailLayout). Chưa có API đọc chi tiết theo mã nên dùng lại danh sách (UC10) lọc theo
 * mã để tìm id, rồi đọc chi tiết từ GET /bookings/:id/summary.
 */
export function ReceptionBookingDetailPage() {
  const { code = '' } = useParams()
  const list = useBookingList({ page: 1, limit: 20, q: code })
  const booking = list.data?.items.find((entry) => entry.code === code)
  const summary = useBookingSummary(booking?.id ?? '')
  const editable = summary.data ? EDITABLE_STATUSES.includes(summary.data.status) : false

  return (
    <PageContainer className="space-y-6">
      {(list.isPending || (booking && summary.isPending)) && (
        <div role="status" className="py-8">
          <p className="text-muted-foreground">Đang tải…</p>
        </div>
      )}

      {list.isError && <Alert tone="danger">{getErrorMessage(list.error)}</Alert>}
      {summary.isError && <Alert tone="danger">{getErrorMessage(summary.error)}</Alert>}

      {list.isSuccess && !booking && (
        <EmptyState
          title="Không tìm thấy booking"
          body="Booking có thể đã bị xoá hoặc mã không đúng."
          action={
            <Button asChild variant="outline" className="rounded-full">
              <Link to="/reception/bookings">Về danh sách booking</Link>
            </Button>
          }
        />
      )}

      {summary.data && (
        <BookingDetailLayout
          summary={summary.data}
          backTo="/reception/bookings"
          backLabel="Đặt phòng"
          actions={
            editable ? (
              <Button asChild variant="outline" className="rounded-full">
                <Link to={`/reception/bookings/${encodeURIComponent(summary.data.code)}/edit`}>
                  <Pencil className="size-4" />
                  Sửa booking
                </Link>
              </Button>
            ) : undefined
          }
          notices={
            editable ? undefined : (
              <p className="text-xs text-muted-foreground">
                Booking ở trạng thái này không còn sửa được.
              </p>
            )
          }
        />
      )}
    </PageContainer>
  )
}
