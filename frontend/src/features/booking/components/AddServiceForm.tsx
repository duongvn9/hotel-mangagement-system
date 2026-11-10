import { useState, type FormEvent } from 'react'
import { Button, Input, NativeSelect } from '@/components/atoms'
import { Alert, FormField } from '@/components/molecules'
import { getErrorMessage } from '@/lib/api-client'
import { useAddServiceCharge, useServiceCatalog } from '../hooks'
import { money, newRequestId } from '../utils'

/** Số lượng tối đa một lần thêm, khớp giới hạn của server. */
const MAX_QUANTITY = 99

/** Thêm dịch vụ/sản phẩm từ danh mục vào hóa đơn của khách đang ở (lễ tân). */
export function AddServiceForm({ bookingId }: { bookingId: string }) {
  const [serviceId, setServiceId] = useState('')
  const [quantity, setQuantity] = useState('1')
  // Giữ nguyên mã khi lưu lỗi để bấm lại không ghi trùng; chỉ đổi mã sau khi ghi thành công.
  const [requestId, setRequestId] = useState(newRequestId)
  const catalog = useServiceCatalog()
  const add = useAddServiceCharge(bookingId)

  // Chỉ những dịch vụ có giá mới thu được tiền.
  const items = (catalog.data ?? []).filter(
    (item) => item.billable && typeof item.unitPriceVND === 'number' && item.unitPriceVND > 0,
  )
  const value = Number(quantity)
  const valid =
    serviceId !== '' &&
    quantity !== '' &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= MAX_QUANTITY

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!valid) return
    try {
      await add.mutateAsync({ serviceId, quantity: value, requestId })
      setServiceId('')
      setQuantity('1')
      setRequestId(newRequestId())
    } catch {
      // Lỗi hiển thị qua add.error; giữ nội dung và mã để lễ tân thử lại.
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 border-t border-border pt-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Thêm dịch vụ / sản phẩm
      </p>
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
        <FormField label="Dịch vụ / sản phẩm" htmlFor={`service-${bookingId}`}>
          <NativeSelect
            id={`service-${bookingId}`}
            value={serviceId}
            onChange={(event) => setServiceId(event.target.value)}
          >
            <option value="">Chọn dịch vụ</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} — {money.format(item.unitPriceVND as number)}
                {item.unit ? `/${item.unit}` : ''}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField label="Số lượng" htmlFor={`service-quantity-${bookingId}`}>
          <Input
            id={`service-quantity-${bookingId}`}
            type="number"
            min={1}
            max={MAX_QUANTITY}
            step={1}
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
          />
        </FormField>
      </div>
      {catalog.isError && (
        <p className="text-sm text-muted-foreground">Không tải được danh mục dịch vụ.</p>
      )}
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={!valid || add.isPending} className="rounded-full">
          Thêm dịch vụ
        </Button>
      </div>
      {add.isError && <Alert tone="danger">{getErrorMessage(add.error)}</Alert>}
    </form>
  )
}
