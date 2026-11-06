import { useState, type FormEvent } from 'react'
import { Button, Input } from '@/components/atoms'
import { Alert, FormField } from '@/components/molecules'
import { getErrorMessage } from '@/lib/api-client'
import type { BookingListItem } from '../api'
import { useAddCharge, useBookingCharges } from '../hooks'
import { money, newRequestId } from '../utils'
import { SettleAndCheckOut } from './SettleAndCheckOut'

/** Mức phụ phí tối đa một khoản (VND), khớp giới hạn của server. */
const MAX_CHARGE = 100_000_000

/** UC17 — Record Checkout Additional Charge. Xem và ghi phụ phí cho khách đang ở, ngay trên dòng booking. */
export function CheckoutCharges({ booking }: { booking: BookingListItem }) {
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
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
      await add.mutateAsync({ amount: value, reason: reason.trim(), requestId })
      setAmount('')
      setReason('')
      setRequestId(newRequestId())
    } catch {
      // Lỗi hiển thị qua add.error; giữ nội dung và mã để lễ tân thử lại.
    }
  }

  return (
    <div className="space-y-3 border-t border-border p-4">
      <Button
        size="sm"
        variant="secondary"
        aria-expanded={open}
        className="rounded-full"
        onClick={() => setOpen((current) => !current)}
      >
        Phụ phí
      </Button>

      {open && (
        <div className="space-y-4 rounded-xl border border-border bg-surface p-4">
          {charges.isError && <Alert tone="danger">{getErrorMessage(charges.error)}</Alert>}
          {charges.isPending && <p className="text-sm text-muted-foreground">Đang tải…</p>}

          {charges.data && (
            <>
              {charges.data.charges.length === 0 ? (
                <p className="text-sm text-muted-foreground">Chưa có phụ phí.</p>
              ) : (
                <ul aria-label="Phụ phí đã ghi" className="space-y-1 text-sm">
                  {charges.data.charges.map((charge, index) => (
                    <li key={charge.sourceId ?? index} className="flex justify-between gap-4">
                      <span className="text-foreground">{charge.reason}</span>
                      <span className="font-semibold tabular-nums text-foreground">
                        {money.format(charge.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="space-y-1 border-t border-border pt-2 text-sm text-muted-foreground">
                <p>Tiền phòng: {money.format(charges.data.totals.roomTotal)}</p>
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
                onReload={() => void charges.refetch()}
                reloading={charges.isFetching}
              />
            </>
          )}

          {booking.status === 'CHECKED_IN' && (
            <form
              onSubmit={submit}
              className="grid gap-3 sm:grid-cols-[160px_1fr_auto] sm:items-end"
            >
              <FormField label="Số tiền (VND)" htmlFor={`charge-amount-${booking.id}`}>
                <Input
                  id={`charge-amount-${booking.id}`}
                  type="number"
                  min={1}
                  max={MAX_CHARGE}
                  step={1}
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                />
              </FormField>
              <FormField label="Lý do" htmlFor={`charge-reason-${booking.id}`}>
                <Input
                  id={`charge-reason-${booking.id}`}
                  maxLength={200}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                />
              </FormField>
              <Button
                type="submit"
                size="sm"
                disabled={!valid || add.isPending}
                className="rounded-full"
              >
                Thêm phụ phí
              </Button>
            </form>
          )}
          {add.isError && <Alert tone="danger">{getErrorMessage(add.error)}</Alert>}
        </div>
      )}
    </div>
  )
}
