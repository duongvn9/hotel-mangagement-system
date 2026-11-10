import { Minus, Plus, Repeat } from 'lucide-react'
import { useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Button, Skeleton, StatusBadge, Textarea } from '@/components/atoms'
import { Alert, EmptyState } from '@/components/molecules'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  PageContainer,
  PageHeader,
  Panel,
} from '@/components/organisms'
import { fdate, vnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import { estimateAmount, serviceOrderState, type CatalogService, type OrderInput } from '../api'
import { useCreateOrder, useOrderChoices, useOrders } from '../hooks'
import { OrderError } from '../presentation'

const MAX_QUANTITY = 10
const MAX_NOTES = 2000

/**
 * Màn "Dịch vụ phòng" của khách, theo prototype app.order-service: chọn dịch vụ, số lượng, ghi
 * chú rồi đặt, cạnh lịch sử đặt dịch vụ. Khách chọn được booking nào để đặt (mặc định là kỳ lưu
 * trú đang ở). Gửi lại cùng một đơn bị lỗi dùng cùng mã yêu cầu để không tạo trùng.
 */
export function RoomServicePage() {
  const [params] = useSearchParams()
  const { contexts, catalog } = useOrderChoices()
  const orders = useOrders({ page: 1, limit: 20 })
  const create = useCreateOrder()
  const [chosenBooking, setChosenBooking] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [serviceId, setServiceId] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [notes, setNotes] = useState('')
  const [placed, setPlaced] = useState('')
  const attempt = useRef<{ payload: string; requestId: string } | null>(null)
  const submitting = useRef(false)

  const bookings = contexts.data?.items ?? []
  const services = catalog.data?.items ?? []
  const prefill = params.get('bookingId') ?? ''
  const stay =
    bookings.find((item) => item.id === chosenBooking) ??
    bookings.find((item) => item.id === prefill) ??
    bookings.find((item) => item.status === 'CHECKED_IN') ??
    bookings[0]
  const service = services.find((item) => item.id === serviceId)
  const amount = service ? estimateAmount(service, quantity) : null
  const loading = contexts.isPending || catalog.isPending

  function changed() {
    attempt.current = null
    setPlaced('')
    create.reset()
  }

  function reload() {
    void contexts.refetch()
    void catalog.refetch()
  }

  async function submit() {
    if (!stay || !service || amount === null || submitting.current || create.isPending) return
    setPlaced('')
    const input: OrderInput = {
      bookingId: stay.id,
      serviceId: service.id,
      quantity,
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    }
    const payload = JSON.stringify(input)
    try {
      if (!attempt.current || attempt.current.payload !== payload) {
        attempt.current = { payload, requestId: crypto.randomUUID() }
      }
      submitting.current = true
      await create.mutateAsync({ ...input, requestId: attempt.current.requestId })
      setPlaced(`Đã đặt ${service.name} — yêu cầu đang chờ duyệt`)
      attempt.current = null
      setServiceId(null)
      setQuantity(1)
      setNotes('')
    } catch {
      // Lỗi hiển thị qua create.error; giữ nội dung để gửi lại cùng mã yêu cầu.
    } finally {
      submitting.current = false
    }
  }

  const subtitle = stay
    ? `Đặt cho ${stay.roomNumber ? `phòng ${stay.roomNumber} · ${stay.code}` : `booking ${stay.code}`}`
    : 'Bạn có thể đặt dịch vụ khi đang lưu trú.'

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title="Dịch vụ phòng"
        subtitle={subtitle}
        actions={
          bookings.length > 0 ? (
            <Button variant="outline" className="rounded-full" onClick={() => setPickerOpen(true)}>
              <Repeat className="size-4" />
              Chọn booking
            </Button>
          ) : undefined
        }
      />

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_380px]">
        <Panel title="Đơn mới">
          {loading && (
            <div role="status" className="space-y-3 text-sm text-muted-foreground">
              <p>Đang tải đặt phòng và dịch vụ…</p>
              <Skeleton aria-hidden="true" className="h-24 rounded-xl" />
            </div>
          )}
          {(contexts.isError || catalog.isError) && (
            <OrderError
              error={contexts.error ?? catalog.error}
              retry={reload}
              presentation="workspace"
            />
          )}
          {placed && <Alert tone="success">{placed}</Alert>}

          {!loading && !contexts.isError && bookings.length === 0 && (
            <EmptyState
              title="Bạn chưa có kỳ lưu trú nào để đặt dịch vụ"
              body="Sau khi đặt phòng được xác nhận, bạn có thể đặt bữa sáng, giặt ủi, đưa đón và nhiều dịch vụ khác tại đây."
            />
          )}
          {!loading && !catalog.isError && bookings.length > 0 && services.length === 0 && (
            <EmptyState title="Hiện không có dịch vụ nào để đặt." />
          )}

          {stay && services.length > 0 && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                {services.map((item) => (
                  <ServiceCard
                    key={item.id}
                    service={item}
                    picked={item.id === serviceId}
                    onPick={() => {
                      changed()
                      setServiceId(item.id)
                    }}
                  />
                ))}
              </div>

              {service && (
                <div className="mt-6 grid gap-4 border-t pt-6">
                  <div className="flex items-center gap-3">
                    <span className="text-sm">Số lượng</span>
                    <Button
                      size="icon"
                      variant="outline"
                      className="size-8 rounded-full"
                      aria-label="Giảm số lượng"
                      disabled={quantity <= 1}
                      onClick={() => {
                        changed()
                        setQuantity(Math.max(1, quantity - 1))
                      }}
                    >
                      <Minus className="size-3" />
                    </Button>
                    <output aria-label="Số lượng" className="w-6 text-center">
                      {quantity}
                    </output>
                    <Button
                      size="icon"
                      variant="outline"
                      className="size-8 rounded-full"
                      aria-label="Tăng số lượng"
                      disabled={quantity >= MAX_QUANTITY}
                      onClick={() => {
                        changed()
                        setQuantity(Math.min(MAX_QUANTITY, quantity + 1))
                      }}
                    >
                      <Plus className="size-3" />
                    </Button>
                    <span className="ml-auto font-semibold tabular-nums">{vnd(amount ?? 0)}</span>
                  </div>
                  <Textarea
                    aria-label="Ghi chú cho nhân viên"
                    placeholder="Ghi chú cho nhân viên (không bắt buộc)"
                    maxLength={MAX_NOTES}
                    value={notes}
                    onChange={(event) => {
                      changed()
                      setNotes(event.target.value)
                    }}
                  />
                  {create.isError && <OrderError error={create.error} presentation="workspace" />}
                  <Button
                    className="w-fit rounded-full"
                    disabled={amount === null || create.isPending}
                    onClick={() => void submit()}
                  >
                    {create.isPending ? 'Đang gửi…' : 'Đặt dịch vụ'}
                  </Button>
                </div>
              )}
            </>
          )}
        </Panel>

        <Panel title="Lịch sử đặt dịch vụ">
          {orders.isPending && <p className="text-sm text-muted-foreground">Đang tải…</p>}
          {orders.isError && (
            <OrderError
              error={orders.error}
              retry={() => void orders.refetch()}
              presentation="workspace"
            />
          )}
          {orders.isSuccess &&
            (orders.data.items.length === 0 ? (
              <p className="text-sm text-muted-foreground">Chưa có đơn nào.</p>
            ) : (
              <div className="divide-y">
                {orders.data.items.map((order) => {
                  const state = serviceOrderState(order)
                  return (
                    <Link
                      key={order.id}
                      to={`/customer/service-orders/${encodeURIComponent(order.id)}`}
                      className="flex w-full items-center justify-between gap-3 py-3 text-left text-sm hover:text-primary"
                    >
                      <span className="min-w-0">
                        <span className="block font-medium break-words">
                          {order.service.name} × {order.quantity}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {fdate(order.createdAt)}
                        </span>
                      </span>
                      <span
                        className={cn(
                          'shrink-0 text-[13px] font-medium',
                          state.tone === 'success' ? 'text-success' : 'text-muted-foreground',
                        )}
                      >
                        {state.label}
                      </span>
                    </Link>
                  )
                })}
              </div>
            ))}
          <div className="pt-3">
            <Link
              to="/customer/service-orders/history"
              className="text-sm text-primary underline underline-offset-4"
            >
              Xem tất cả
            </Link>
          </div>
        </Panel>
      </div>

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Chọn booking</DialogTitle>
            <DialogDescription>Dịch vụ sẽ được đặt cho booking bạn chọn.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            {bookings.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={item.id === stay?.id}
                onClick={() => {
                  changed()
                  setChosenBooking(item.id)
                  setPickerOpen(false)
                }}
                className={cn(
                  'rounded-xl border p-4 text-left transition',
                  item.id === stay?.id ? 'border-primary bg-primary/5' : 'hover:border-primary/50',
                )}
              >
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{item.code}</span>
                  <StatusBadge status={item.status} />
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {item.roomNumber ? `Phòng ${item.roomNumber} · ` : ''}
                  {fdate(item.checkIn)} → {fdate(item.checkOut)}
                </span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </PageContainer>
  )
}

function ServiceCard({
  service,
  picked,
  onPick,
}: {
  service: CatalogService
  picked: boolean
  onPick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={picked}
      onClick={onPick}
      className={cn(
        'rounded-xl border p-4 text-left transition',
        picked ? 'border-primary bg-primary/5' : 'hover:border-primary/50',
      )}
    >
      <div className="font-medium break-words">{service.name}</div>
      <div className="text-xs text-muted-foreground">{service.unit}</div>
      <div className="mt-2 text-sm">
        {service.billable ? vnd(service.unitPriceVND) : 'Miễn phí'}
      </div>
    </button>
  )
}
