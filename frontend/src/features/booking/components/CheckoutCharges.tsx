import { useState, type FormEvent } from 'react'
import { LogOut } from 'lucide-react'
import { Button, Input, NativeSelect } from '@/components/atoms'
import { Alert, FormField } from '@/components/molecules'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/organisms'
import { getErrorMessage } from '@/lib/api-client'
import { CHARGE_CATEGORY_LABEL, type BookingListItem, type ChargeCategory } from '../api'
import { useAddCharge, useBookingCharges } from '../hooks'
import { isPastCheckOut, money, newRequestId } from '../utils'
import { AddServiceForm } from './AddServiceForm'
import { CheckoutInspection } from './CheckoutInspection'
import { SettleAndCheckOut } from './SettleAndCheckOut'

/** Mức phụ phí tối đa một khoản (VND), khớp giới hạn của server. */
const MAX_CHARGE = 100_000_000

/** UC17 & UC18 — Trả phòng & Ghi phụ phí. Mở qua Dialog chuyên dụng để tránh làm vỡ giao diện thẻ quầy lễ tân. */
export function CheckoutCharges({
  booking,
  detailLink,
}: {
  booking: BookingListItem
  detailLink?: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [category, setCategory] = useState<ChargeCategory | ''>('')
  // Giữ nguyên mã khi lưu lỗi để bấm lại không ghi trùng; chỉ đổi mã sau khi ghi thành công.
  const [requestId, setRequestId] = useState(newRequestId)
  const charges = useBookingCharges(open ? booking.id : null)
  const add = useAddCharge(booking.id)

  const value = Number(amount)
  const valid =
    amount !== '' &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= MAX_CHARGE &&
    reason.trim() !== ''

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!valid) return
    try {
      await add.mutateAsync({
        amount: value,
        reason: reason.trim(),
        ...(category ? { category } : {}),
        requestId,
      })
      setAmount('')
      setReason('')
      setCategory('')
      setRequestId(newRequestId())
    } catch {
      // Lỗi hiển thị qua add.error; giữ nội dung và mã để lễ tân thử lại.
    }
  }

  const roomNumbers = booking.rooms
    ?.map((r) => r.roomNumber)
    .filter(Boolean)
    .join(', ')

  return (
    <>
      <div className="flex gap-2">
        <Button className="flex-1 rounded-full" aria-expanded={open} onClick={() => setOpen(true)}>
          <LogOut className="mr-1.5 size-4" />
          Trả phòng
        </Button>
        {detailLink}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Trả phòng — {booking.code}</DialogTitle>
            <DialogDescription>
              {booking.guestName || 'Khách'} · Phòng {roomNumbers || 'Chưa gán'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {charges.isError && <Alert tone="danger">{getErrorMessage(charges.error)}</Alert>}
            {charges.isPending && (
              <p className="text-sm text-muted-foreground">Đang tải hóa đơn…</p>
            )}

            {charges.data && (
              <>
                <div className="rounded-xl border border-border bg-surface p-4">
                  <h4 className="mb-3 text-sm font-semibold text-foreground">Tổng hợp hóa đơn</h4>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <p>Tiền phòng: {money.format(charges.data.totals.roomTotal)}</p>
                    <p>Dịch vụ: {money.format(charges.data.totals.serviceTotal)}</p>
                    <p>Phụ phí: {money.format(charges.data.totals.additionalTotal)}</p>
                    <p>Tổng cộng: {money.format(charges.data.totals.totalAmount)}</p>
                    <p>Đã cọc: {money.format(charges.data.totals.depositPaid)}</p>
                    <p className="font-semibold text-foreground">
                      Còn phải trả: {money.format(charges.data.totals.balanceDue)}
                    </p>
                  </div>

                  <SettleAndCheckOut
                    booking={booking}
                    totals={charges.data.totals}
                    feesConfirmedAt={charges.data.feesConfirmedAt}
                    vnpayPending={charges.data.vnpayPending === true}
                    onReload={() => void charges.refetch()}
                    reloading={charges.isFetching}
                  />
                </div>

                {booking.status === 'CHECKED_IN' && <CheckoutInspection bookingId={booking.id} />}

                <div className="space-y-3 rounded-xl border border-border bg-surface p-4">
                  <h4 className="text-sm font-semibold text-foreground">Phụ phí</h4>
                  {booking.status === 'CHECKED_IN' && isPastCheckOut(booking.checkOut) && (
                    <p className="text-sm text-warning">
                      Đã quá giờ trả phòng dự kiến, kiểm tra và ghi phí trả phòng muộn nếu có.
                    </p>
                  )}
                  {charges.data.charges.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Chưa có phụ phí.</p>
                  ) : (
                    <ul aria-label="Phụ phí đã ghi" className="divide-y divide-border text-sm">
                      {charges.data.charges.map((charge, index) => (
                        <li
                          key={charge.sourceId ?? index}
                          className="flex justify-between gap-3 py-1.5"
                        >
                          <span className="min-w-0 break-words text-foreground">
                            {charge.serviceName ?? charge.reason}
                            {charge.serviceName &&
                              charge.quantity !== undefined &&
                              charge.unitPriceVND !== undefined && (
                                <span className="block text-xs text-muted-foreground">
                                  Số lượng: {charge.quantity} · Đơn giá:{' '}
                                  {money.format(charge.unitPriceVND)}
                                </span>
                              )}
                            {charge.category && (
                              <span className="ml-2 text-xs text-muted-foreground">
                                {CHARGE_CATEGORY_LABEL[charge.category]}
                              </span>
                            )}
                          </span>
                          <span className="font-semibold tabular-nums text-foreground">
                            {money.format(charge.amount)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {booking.status === 'CHECKED_IN' && <AddServiceForm bookingId={booking.id} />}

                  {booking.status === 'CHECKED_IN' && (
                    <form onSubmit={submit} className="space-y-3 border-t border-border pt-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Thêm phụ phí
                      </p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <FormField label="Số tiền (VND)" htmlFor={`charge-amount-${booking.id}`}>
                          <Input
                            id={`charge-amount-${booking.id}`}
                            type="number"
                            min={1}
                            max={MAX_CHARGE}
                            step={1}
                            placeholder="VD: 50000"
                            value={amount}
                            onChange={(event) => setAmount(event.target.value)}
                          />
                        </FormField>
                        <FormField label="Lý do" htmlFor={`charge-reason-${booking.id}`}>
                          <Input
                            id={`charge-reason-${booking.id}`}
                            maxLength={200}
                            placeholder="VD: Nước suối minibar"
                            value={reason}
                            onChange={(event) => setReason(event.target.value)}
                          />
                        </FormField>
                      </div>
                      <FormField label="Loại phụ phí" htmlFor={`charge-category-${booking.id}`}>
                        <NativeSelect
                          id={`charge-category-${booking.id}`}
                          value={category}
                          onChange={(event) =>
                            setCategory(event.target.value as ChargeCategory | '')
                          }
                        >
                          <option value="">Không phân loại</option>
                          <option value="DAMAGE">{CHARGE_CATEGORY_LABEL.DAMAGE}</option>
                          <option value="LATE_CHECKOUT">
                            {CHARGE_CATEGORY_LABEL.LATE_CHECKOUT}
                          </option>
                          <option value="OTHER">{CHARGE_CATEGORY_LABEL.OTHER}</option>
                        </NativeSelect>
                      </FormField>
                      <div className="flex justify-end">
                        <Button
                          type="submit"
                          size="sm"
                          disabled={!valid || add.isPending}
                          className="rounded-full"
                        >
                          Thêm phụ phí
                        </Button>
                      </div>
                    </form>
                  )}
                  {add.isError && <Alert tone="danger">{getErrorMessage(add.error)}</Alert>}
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" className="rounded-full" onClick={() => setOpen(false)}>
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
