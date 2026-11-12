import { useRef, useState } from 'react'
import { Pencil, XCircle } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { Button } from '@/components/atoms'
import { Alert, EmptyState } from '@/components/molecules'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  PageContainer,
} from '@/components/organisms'
import { getErrorMessage } from '@/lib/api-client'
import { useBookingList, useBookingSummary, useCancelBooking } from '../hooks'
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
  const [confirmCancel, setConfirmCancel] = useState(false)
  const cancellingRef = useRef(false)
  const cancel = useCancelBooking()
  const cancellable = summary.data && ['ROOM_HELD', 'PENDING_DEPOSIT'].includes(summary.data.status)

  async function doCancel() {
    if (!booking || !cancellable || cancellingRef.current) return
    cancellingRef.current = true
    try {
      await cancel.mutateAsync({ id: booking.id })
      setConfirmCancel(false)
      await Promise.all([list.refetch(), summary.refetch()])
    } catch {
      // Keep the confirmation open for retry; backend enforces ownership and expiry.
    } finally {
      cancellingRef.current = false
    }
  }

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
            <>
              {editable && (
                <Button asChild variant="outline" className="rounded-full">
                  <Link to={`/reception/bookings/${encodeURIComponent(summary.data.code)}/edit`}>
                    <Pencil className="size-4" />
                    Sửa booking
                  </Link>
                </Button>
              )}
              {cancellable && (
                <Button
                  variant="ghost"
                  className="rounded-full text-destructive hover:bg-destructive/10"
                  disabled={cancel.isPending}
                  onClick={() => {
                    cancel.reset()
                    setConfirmCancel(true)
                  }}
                >
                  <XCircle className="size-4" />
                  Huỷ booking
                </Button>
              )}
            </>
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
      <AlertDialog
        open={confirmCancel}
        onOpenChange={(open) => {
          if (!cancellingRef.current) setConfirmCancel(open)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận huỷ booking</AlertDialogTitle>
            <AlertDialogDescription>
              Huỷ booking {summary.data?.code}? Phòng đang giữ sẽ được mở lại. Thao tác không thể
              hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {cancel.isError && <Alert tone="danger">{getErrorMessage(cancel.error)}</Alert>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancel.isPending}>Giữ lại</AlertDialogCancel>
            <AlertDialogAction
              disabled={cancel.isPending || !cancellable}
              onClick={(event) => {
                event.preventDefault()
                void doCancel()
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancel.isPending ? 'Đang huỷ…' : 'Xác nhận huỷ'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  )
}
