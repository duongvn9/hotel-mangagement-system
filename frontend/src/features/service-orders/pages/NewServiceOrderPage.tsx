import { AssetImage } from '@/components/AssetImage'
import { useRef, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router'
import { Button } from '@/components/Button'
import { TextField } from '@/components/TextField'
import { SelectField } from '@/components/SelectField'
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
      <section className="mx-auto max-w-container px-4 py-8">
        <OrderNavigation />
        <h1 className="mb-6 font-display text-3xl">Đã gửi yêu cầu dịch vụ</h1>
        <OrderReceipt order={receipt} />
        <Button
          className="mt-6"
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
      </section>
    )
  return (
    <section className="mx-auto max-w-container px-4 py-8">
      <OrderNavigation />
      <h1 className="mb-6 font-display text-3xl">Yêu cầu dịch vụ</h1>
      {loading && <p role="status">Đang tải đặt phòng và dịch vụ…</p>}
      {contexts.isError && <OrderError error={contexts.error} retry={reload} />}
      {catalog.isError && <OrderError error={catalog.error} retry={reload} />}
      {!loading && !contexts.isError && !bookings.length && (
        <p role="status">Bạn chưa có kỳ lưu trú nào (đã xác nhận trở lên) để yêu cầu dịch vụ.</p>
      )}
      {!loading && !catalog.isError && !services.length && (
        <p role="status">Hiện không có dịch vụ đang hoạt động để yêu cầu.</p>
      )}
      {!loading && !contexts.isError && !catalog.isError && invalidPrefill && (
        <p role="status" className="mb-4 text-stone-700">
          Đặt phòng hoặc dịch vụ trong liên kết không có trong lựa chọn hợp lệ. Vui lòng tự chọn từ
          danh sách.
        </p>
      )}
      <button
        type="button"
        onClick={reload}
        disabled={mutation.isPending}
        className="mb-4 min-h-11 text-primary underline"
      >
        Tải lại lựa chọn
      </button>
      <form onSubmit={submit} noValidate className="max-w-2xl space-y-5">
        <fieldset disabled={unavailable || mutation.isPending} className="min-w-0 space-y-5">
          <SelectField
            label="Kỳ lưu trú"
            required
            value={chosenBooking}
            onChange={(e) => {
              changed()
              setBookingId(e.target.value)
            }}
            options={[
              { value: '', label: 'Chọn đặt phòng' },
              ...bookings.map((item) => ({
                value: item.id,
                label: `${item.code} · ${dateTime(item.checkIn)} – ${dateTime(item.checkOut)}`,
              })),
            ]}
          />
          <SelectField
            label="Dịch vụ"
            required
            value={chosenService}
            onChange={(e) => {
              changed()
              setServiceId(e.target.value)
            }}
            options={[
              { value: '', label: 'Chọn dịch vụ' },
              ...services.map((item) => ({ value: item.id, label: `${item.name} · ${item.unit}` })),
            ]}
          />
          {service && (
            <div className="space-y-2 rounded bg-cream-50 p-4">
              <AssetImage path={service.imageUrl} name={service.name} />
              <p className="whitespace-pre-wrap break-words">{service.description}</p>
              <p>
                Đơn giá dự kiến: {money(service.billable ? service.unitPriceVND : 0)} /{' '}
                {service.unit}
                {!service.billable && ' · Không tính phí'}
              </p>
            </div>
          )}
          <TextField
            label="Số lượng"
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
          <TextField
            label="Thời gian yêu cầu (không bắt buộc)"
            type="datetime-local"
            value={requestedTime}
            onChange={(e) => {
              changed()
              setRequestedTime(e.target.value)
            }}
          />
          <p className="text-sm text-stone-700">
            Để trống thời gian để dùng thời điểm hiện tại của máy chủ.
          </p>
          <label className="block text-sm font-medium">
            Ghi chú (không bắt buộc, tối đa 2000 ký tự)
            <textarea
              maxLength={2000}
              rows={4}
              value={notes}
              onChange={(e) => {
                changed()
                setNotes(e.target.value)
              }}
              className="mt-2 block w-full rounded border border-stone-300 bg-white p-3 disabled:bg-stone-200"
            />
          </label>
          <p aria-live="polite">
            Thành tiền ước tính: {amount === null ? 'Chưa có ước tính hợp lệ' : money(amount)}
          </p>
          <p className="text-sm text-stone-700">
            Đây chỉ là ước tính. Giá và thành tiền do máy chủ xác nhận sau khi gửi. Yêu cầu sẽ chờ
            duyệt, chưa được chấp nhận và chưa ghi thu phí.
          </p>
          <Button
            type="submit"
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
        {mutation.isError && <OrderError error={mutation.error} />}
      </form>
    </section>
  )
}
