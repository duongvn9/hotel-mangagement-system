import { useQueryClient } from '@tanstack/react-query'
import { Banknote, DoorOpen } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Button, NativeSelect } from '@/components/atoms'
import { Alert, FormField } from '@/components/molecules'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/organisms'
import { getErrorMessage } from '@/lib/api-client'
import type { BookingListItem, DeskDepositMethod } from '../api'
import { useCancelBooking, useInitiateDeposit, useRecordDeskDeposit } from '../hooks'
import { rememberPaymentRef } from '../storage'
import { money, newRequestId } from '../utils'

type DepositMethod = DeskDepositMethod | 'VNPAY'

/** Làm mới các danh sách phụ thuộc vào trạng thái cọc và phòng của booking. */
const REFRESH_KEYS = ['same-day', 'bookings', 'availability', 'room-status-board']

/**
 * Khách đến chưa đóng cọc: lễ tân thu cọc (tiền mặt, thẻ hoặc VNPay) rồi mới nhận phòng được,
 * hoặc nhả phòng (huỷ booking) nếu khách không đóng.
 */
export function DepositDueAction({
  booking,
  detailLink,
}: {
  booking: BookingListItem
  detailLink?: ReactNode
}) {
  const queryClient = useQueryClient()
  const [depositOpen, setDepositOpen] = useState(false)
  const [releaseOpen, setReleaseOpen] = useState(false)
  const [method, setMethod] = useState<DepositMethod | ''>('')
  const [vnpayOpened, setVnpayOpened] = useState(false)
  // Giữ nguyên mã khi ghi lỗi để bấm lại không thu trùng.
  const [requestId, setRequestId] = useState(newRequestId)
  const record = useRecordDeskDeposit()
  const vnpay = useInitiateDeposit()
  const cancel = useCancelBooking()
  const amount = booking.depositAmount ?? 0

  function refresh() {
    return Promise.all(
      REFRESH_KEYS.map((queryKey) => queryClient.invalidateQueries({ queryKey: [queryKey] })),
    )
  }

  function closeDeposit(open: boolean) {
    setDepositOpen(open)
    if (!open) {
      setMethod('')
      setVnpayOpened(false)
      record.reset()
      vnpay.reset()
    }
  }

  async function confirmDeposit() {
    if (!method) return
    try {
      if (method === 'VNPAY') {
        const result = await vnpay.mutateAsync({ bookingId: booking.id })
        // Nhớ giao dịch thuộc booking nào để trang kết quả VNPay cập nhật đúng.
        rememberPaymentRef(result.transactionRef, booking.id)
        window.open(result.paymentUrl, '_blank', 'noopener')
        setVnpayOpened(true)
        return
      }
      await record.mutateAsync({ id: booking.id, method, requestId })
      setRequestId(newRequestId())
      closeDeposit(false)
    } catch {
      // Lỗi hiển thị qua record.error / vnpay.error; giữ hộp thoại để thử lại.
    }
  }

  async function release() {
    try {
      await cancel.mutateAsync({ id: booking.id })
      await refresh()
      setReleaseOpen(false)
    } catch {
      // Lỗi hiển thị qua cancel.error trong hộp thoại.
    }
  }

  const failed = record.isError ? record.error : vnpay.isError ? vnpay.error : null

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-warning">Chưa đóng cọc {money.format(amount)}</p>
      <div className="flex flex-wrap gap-2">
        <Button className="flex-1 rounded-full" onClick={() => setDepositOpen(true)}>
          <Banknote className="mr-1.5 size-4" />
          Thu cọc
        </Button>
        <Button
          variant="outline"
          className="rounded-full"
          onClick={() => {
            cancel.reset()
            setReleaseOpen(true)
          }}
        >
          <DoorOpen className="mr-1.5 size-4" />
          Nhả phòng
        </Button>
        {detailLink}
      </div>

      <Dialog open={depositOpen} onOpenChange={closeDeposit}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Thu cọc — {booking.code}</DialogTitle>
            <DialogDescription>
              {booking.guestName || 'Khách'} cần đóng cọc {money.format(amount)} trước khi nhận
              phòng.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <FormField label="Hình thức thu cọc" htmlFor={`deposit-method-${booking.id}`} required>
              <NativeSelect
                id={`deposit-method-${booking.id}`}
                value={method}
                onChange={(event) => setMethod(event.target.value as DepositMethod | '')}
              >
                <option value="">Chọn hình thức</option>
                <option value="CASH">Tiền mặt</option>
                <option value="CARD">Thẻ</option>
                <option value="VNPAY">VNPay</option>
              </NativeSelect>
            </FormField>
            {vnpayOpened && (
              <Alert tone="info">
                Đã mở trang VNPay để khách thanh toán cọc. Cọc được ghi nhận khi VNPay xác nhận; bấm
                Tải lại danh sách để cập nhật.
              </Alert>
            )}
            {failed !== null && <Alert tone="danger">{getErrorMessage(failed)}</Alert>}
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-full" onClick={() => closeDeposit(false)}>
              Đóng
            </Button>
            {vnpayOpened ? (
              <Button className="rounded-full" onClick={() => void refresh()}>
                Tải lại danh sách
              </Button>
            ) : (
              <Button
                className="rounded-full"
                disabled={!method || record.isPending || vnpay.isPending}
                onClick={() => void confirmDeposit()}
              >
                {method === 'VNPAY' ? 'Mở trang VNPay' : 'Xác nhận thu cọc'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={releaseOpen} onOpenChange={setReleaseOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Nhả phòng của {booking.code}?</AlertDialogTitle>
            <AlertDialogDescription>
              Khách chưa đóng cọc. Booking sẽ bị huỷ và phòng được mở lại cho khách khác. Thao tác
              không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {cancel.isError && <Alert tone="danger">{getErrorMessage(cancel.error)}</Alert>}
          <AlertDialogFooter>
            <AlertDialogCancel>Giữ lại</AlertDialogCancel>
            <AlertDialogAction
              disabled={cancel.isPending}
              onClick={(event) => {
                event.preventDefault()
                void release()
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Nhả phòng
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
