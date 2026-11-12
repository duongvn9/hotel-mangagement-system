import { RoomGallery } from '@/components/AssetImage'
import { useRef, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router'
import { Button, Input, NativeSelect, Skeleton, Textarea } from '@/components/atoms'
import { EmptyState, FormField } from '@/components/molecules'
import { PageContainer, PageHeader, Panel } from '@/components/organisms'
import { dateTime, money, estimateAmount, type OrderInput, type ServiceOrder } from '../api'
import { useCreateOrder, useOrderChoices } from '../hooks'
import { OrderError, OrderNavigation, OrderReceipt } from '../presentation'

export function NewServiceOrderPage() {
  const [params] = useSearchParams()
  const { contexts, catalog } = useOrderChoices()
  const mutation = useCreateOrder()
  const [bookingId, setBookingId] = useState<string | null>(null)
  const [serviceId, setServiceId] = useState<string | null>(null)
  const [quantity, setQuantity] = useState('1')
  const [requestedTime, setRequestedTime] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [receipt, setReceipt] = useState<ServiceOrder | null>(null)
  const attempt = useRef<{ payload: string; requestId: string } | null>(null)
  const submitting = useRef(false)
  const bookings = contexts.data?.items ?? []
  const services = catalog.data?.items ?? []
  const bookingPrefill = params.get('bookingId') ?? ''
  const servicePrefill = params.get('serviceId') ?? ''
  const chosenBooking =
    bookingId ?? (bookings.some((item) => item.id === bookingPrefill) ? bookingPrefill : '')
  const chosenService =
    serviceId ?? (services.some((item) => item.id === servicePrefill) ? servicePrefill : '')
  const service = services.find((item) => item.id === chosenService)
  const amount = service ? estimateAmount(service, Number(quantity)) : null
  const invalidPrefill =
    (bookingPrefill && !bookings.some((item) => item.id === bookingPrefill)) ||
    (servicePrefill && !services.some((item) => item.id === servicePrefill))
  const loading = contexts.isPending || catalog.isPending
  const unavailable =
    loading || contexts.isError || catalog.isError || !bookings.length || !services.length
  function changed() {
    attempt.current = null
    setError('')
    mutation.reset()
  }
  function reload() {
    void contexts.refetch()
    void catalog.refetch()
  }
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (submitting.current || mutation.isPending || receipt) return
    setError('')
    if (unavailable || !bookings.some((item) => item.id === chosenBooking) || !service) {
      setError('Vui lòng chọn đặt phòng và dịch vụ từ danh sách hiện có.')
      return
    }
    if (!/^\d+$/.test(quantity) || amount === null) {
      setError(
        'Số lượng phải là số nguyên dương an toàn; thành tiền không được vượt giới hạn số an toàn.',
      )
      return
    }
    if (notes.trim().length > 2000) {
      setError('Ghi chú tối đa 2000 ký tự.')
      return
    }
    const date = requestedTime ? new Date(requestedTime) : null
    if (date && !Number.isFinite(date.getTime())) {
      setError('Thời gian yêu cầu không hợp lệ.')
      return
    }
    const input: OrderInput = {
      bookingId: chosenBooking,
      serviceId: chosenService,
      quantity: Number(quantity),
      ...(date ? { requestedTime: date.toISOString() } : {}),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    }
    const payload = JSON.stringify(input)
    try {
      if (!attempt.current || attempt.current.payload !== payload)
        attempt.current = { payload, requestId: crypto.randomUUID() }
      submitting.current = true
      const order = await mutation.mutateAsync({ ...input, requestId: attempt.current.requestId })
      setReceipt(order)
    } catch {
      if (!attempt.current)
        setError(
          'Không thể tạo mã yêu cầu an toàn. Vui lòng dùng trình duyệt hỗ trợ HTTPS và thử lại.',
        )
    } finally {
      submitting.current = false
    }
  }
  if (receipt)
    return (
      <PageContainer>
        <OrderNavigation variant="back" />
        <PageHeader title="Đã gửi yêu cầu dịch vụ" />
        <OrderReceipt order={receipt} presentation="workspace" />
        <Button
          className="mt-6 rounded-full"
          onClick={() => {
            setReceipt(null)
            attempt.current = null
            mutation.reset()
            setError('')
            reload()
          }}
        >
          Tạo yêu cầu mới
        </Button>
      </PageContainer>
    )
  return (
    <PageContainer>
      <OrderNavigation variant="back" />
      <PageHeader title="Yêu cầu dịch vụ" />
      <Panel title="Đơn mới">
        {loading && (
          <div role="status" className="space-y-4 text-sm text-muted-foreground">
            <p>Đang tải đặt phòng và dịch vụ…</p>
            <Skeleton aria-hidden="true" className="h-24 rounded-xl" />
          </div>
        )}
        {contexts.isError && (
          <OrderError error={contexts.error} retry={reload} presentation="workspace" />
        )}
        {catalog.isError && (
          <OrderError error={catalog.error} retry={reload} presentation="workspace" />
        )}
        {!loading && !contexts.isError && !bookings.length && (
          <div role="status">
            <EmptyState title="Bạn chưa có kỳ lưu trú nào (đã xác nhận trở lên) để yêu cầu dịch vụ." />
          </div>
        )}
        {!loading && !catalog.isError && !services.length && (
          <div role="status">
            <EmptyState title="Hiện không có dịch vụ đang hoạt động để yêu cầu." />
          </div>
        )}
        {!loading && !contexts.isError && !catalog.isError && invalidPrefill && (
          <p role="status" className="mb-4 text-muted-foreground">
            Đặt phòng hoặc dịch vụ trong liên kết không có trong lựa chọn hợp lệ. Vui lòng tự chọn
            từ danh sách.
          </p>
        )}
        <Button
          type="button"
          variant="link"
          onClick={reload}
          disabled={mutation.isPending}
          className="my-4"
        >
          Tải lại lựa chọn
        </Button>
        <form onSubmit={submit} noValidate className="min-w-0 space-y-5">
          <fieldset disabled={unavailable || mutation.isPending} className="min-w-0 space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Kỳ lưu trú" htmlFor="order-booking" required>
                <NativeSelect
                  id="order-booking"
                  required
                  value={chosenBooking}
                  onChange={(e) => {
                    changed()
                    setBookingId(e.target.value)
                  }}
                >
                  <option value="">Chọn đặt phòng</option>
                  {bookings.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.code} · {dateTime(item.checkIn)} – {dateTime(item.checkOut)}
                    </option>
                  ))}
                </NativeSelect>
              </FormField>
              <FormField label="Dịch vụ" htmlFor="order-service" required>
                <NativeSelect
                  id="order-service"
                  required
                  value={chosenService}
                  onChange={(e) => {
                    changed()
                    setServiceId(e.target.value)
                  }}
                >
                  <option value="">Chọn dịch vụ</option>
                  {services.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} · {item.unit}
                    </option>
                  ))}
                </NativeSelect>
              </FormField>
            </div>
            {service && (
              <div className="min-w-0 space-y-3 rounded-xl border border-border bg-surface/50 p-4 text-sm">
                <RoomGallery
                  images={service.imageUrl ? [service.imageUrl] : []}
                  name={service.name}
                />
                <p className="whitespace-pre-wrap break-words">{service.description}</p>
                <p>
                  Đơn giá dự kiến: {money(service.billable ? service.unitPriceVND : 0)} /{' '}
                  {service.unit}
                  {!service.billable && ' · Không tính phí'}
                </p>
              </div>
            )}
            <div className="grid gap-4 border-t border-border pt-6 sm:grid-cols-2">
              <FormField label="Số lượng" htmlFor="order-quantity" required>
                <Input
                  id="order-quantity"
                  required
                  type="number"
                  min="1"
                  step="1"
                  max={Number.MAX_SAFE_INTEGER}
                  value={quantity}
                  onChange={(e) => {
                    changed()
                    setQuantity(e.target.value)
                  }}
                />
              </FormField>
              <FormField label="Thời gian yêu cầu (không bắt buộc)" htmlFor="order-time">
                <Input
                  id="order-time"
                  type="datetime-local"
                  value={requestedTime}
                  onChange={(e) => {
                    changed()
                    setRequestedTime(e.target.value)
                  }}
                />
              </FormField>
            </div>
            <p className="text-sm text-muted-foreground">
              Để trống thời gian để dùng thời điểm hiện tại của máy chủ.
            </p>
            <FormField label="Ghi chú (không bắt buộc, tối đa 2000 ký tự)" htmlFor="order-notes">
              <Textarea
                id="order-notes"
                maxLength={2000}
                rows={4}
                value={notes}
                onChange={(e) => {
                  changed()
                  setNotes(e.target.value)
                }}
                className="min-w-0"
              />
            </FormField>
            <p aria-live="polite" className="text-sm font-semibold break-words">
              Thành tiền ước tính: {amount === null ? 'Chưa có ước tính hợp lệ' : money(amount)}
            </p>
            <p className="text-sm text-muted-foreground">
              Đây chỉ là ước tính. Giá và thành tiền do máy chủ xác nhận sau khi gửi. Yêu cầu sẽ chờ
              duyệt, chưa được chấp nhận và chưa ghi thu phí.
            </p>
            <Button
              type="submit"
              className="w-full rounded-full sm:w-fit"
              disabled={amount === null || !chosenBooking || !service || mutation.isPending}
            >
              {mutation.isPending ? 'Đang gửi…' : 'Gửi yêu cầu'}
            </Button>
          </fieldset>
          {error && (
            <p role="alert" className="text-danger">
              {error}
            </p>
          )}
          {mutation.isError && <OrderError error={mutation.error} presentation="workspace" />}
        </form>
      </Panel>
    </PageContainer>
  )
}
