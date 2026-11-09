import { isAxiosError } from 'axios'
import { useRef, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { CheckCircle2 } from 'lucide-react'
import { Button, Input, NativeSelect, Skeleton, Textarea } from '@/components/atoms'
import { Alert, EmptyState, FormField } from '@/components/molecules'
import { PageContainer, PageHeader, Panel } from '@/components/organisms'
import { useAuth } from '@/features/auth/auth-context'
import { reviewLabels, executionLabels } from '@/features/service-orders/api'
import {
  normalizeIssueInput,
  validateIssue,
  type IssueErrors,
  type IssueInput,
  type IssueReportBooking,
  type ReportIssueInput,
} from '../api'
import { useIssueReportContext, useReportIssue } from '../hooks'

const categories = ['', 'Phòng và tiện nghi', 'Vệ sinh', 'Khác']
type Mode = 'booking' | 'room' | 'service'
type Intent = {
  signature: string
  payload: ReportIssueInput
  booking: IssueReportBooking
  uncertain: boolean
}

function bookingLabel(booking: IssueReportBooking) {
  return `${booking.code} · ${new Date(booking.checkIn).toLocaleDateString('vi-VN')} – ${new Date(booking.checkOut).toLocaleDateString('vi-VN')} · ${booking.status === 'CHECKED_IN' ? 'Đang lưu trú' : booking.status} · ${booking.rooms.map((room) => room.roomNumber).join(', ')}`
}

function errorMessage(error: unknown) {
  const status = isAxiosError(error) ? error.response?.status : undefined
  if (status === 400)
    return 'Thông tin chưa hợp lệ hoặc đặt phòng không còn phù hợp để báo sự cố. Vui lòng kiểm tra lại.'
  if (status === 403)
    return 'Bạn không có quyền gửi báo cáo này. Vui lòng kiểm tra tài khoản đang đăng nhập.'
  if (status === 404)
    return 'Không tìm thấy đặt phòng, phòng hoặc đơn dịch vụ phù hợp. Vui lòng chọn lại ngữ cảnh.'
  if (status === 409)
    return 'Báo cáo xung đột với yêu cầu trước đó. Vui lòng kiểm tra ngữ cảnh hoặc liên hệ lễ tân.'
  if (status === 401) return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại trước khi gửi.'
  return 'Chưa nhận được xác nhận gửi báo cáo. Gửi lại cùng nội dung sẽ dùng lại mã yêu cầu để tránh tạo trùng.'
}

export function ReportIssuePage() {
  const { me } = useAuth()
  return <CustomerIssueForm key={`${me?.id}:${me?.role}`} />
}

function CustomerIssueForm() {
  const [params] = useSearchParams()
  const context = useIssueReportContext()
  const mutation = useReportIssue()
  const [input, setInput] = useState<IssueInput>(() => ({
    title: '',
    category: '',
    description: '',
    bookingId: params.get('bookingId') ?? '',
    roomId: params.get('roomId') ?? '',
    serviceOrderId: params.get('serviceOrderId') ?? '',
  }))
  const [mode, setMode] = useState<Mode>(() =>
    params.has('serviceOrderId') ? 'service' : params.has('roomId') ? 'room' : 'booking',
  )
  const [chosen, setChosen] = useState(params.has('bookingId'))
  const [prefillCleared, setPrefillCleared] = useState(false)
  const [errors, setErrors] = useState<IssueErrors>({})
  const [intent, setIntent] = useState<Intent>()
  const [intents, setIntents] = useState(() => new Map<string, Intent>())
  const submitting = useRef(false)
  const bookings = (context.data?.items ?? []).filter((item) => item.status === 'CHECKED_IN')
  const bookingId = chosen ? input.bookingId : bookings.length === 1 ? bookings[0].id : ''
  const booking = bookings.find((item) => item.id === bookingId && item.status === 'CHECKED_IN')
  const payload = normalizeIssueInput({
    ...input,
    bookingId,
    roomId: mode === 'room' ? input.roomId : undefined,
    serviceOrderId: mode === 'service' ? input.serviceOrderId : undefined,
  })
  const signature = JSON.stringify(payload)
  const matchingIntent = intents.get(signature)
  const replay = Boolean(matchingIntent?.uncertain)
  const linkedBooking = bookings.find((item) => item.id === params.get('bookingId'))
  const invalidPrefill =
    !prefillCleared &&
    (params.has('bookingId') || params.has('roomId') || params.has('serviceOrderId')) &&
    (!linkedBooking ||
      (params.has('roomId') &&
        !linkedBooking.rooms.some((room) => room.id === params.get('roomId'))) ||
      (params.has('serviceOrderId') &&
        !linkedBooking.serviceOrders.some((order) => order.id === params.get('serviceOrderId'))) ||
      (params.has('roomId') && params.has('serviceOrderId')))

  function update(key: keyof IssueInput, value: string) {
    setInput((previous) => ({
      ...previous,
      [key]: value,
      ...(key === 'bookingId' ? { roomId: '', serviceOrderId: '' } : {}),
    }))
    if (key === 'bookingId') {
      setMode('booking')
      setChosen(true)
      setPrefillCleared(true)
    }
    setErrors({})
    mutation.reset()
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting.current || mutation.isSuccess) return
    const nextErrors = validateIssue(payload)
    if (!replay) {
      if (!booking || context.isError || context.isFetching || invalidPrefill)
        nextErrors.bookingId = 'Vui lòng chọn đặt phòng hợp lệ từ ngữ cảnh mới nhất.'
      if (mode === 'room' && !booking?.rooms.some((room) => room.id === payload.roomId))
        nextErrors.roomId = 'Vui lòng chọn phòng thuộc đặt phòng này.'
      if (
        mode === 'service' &&
        !booking?.serviceOrders.some((order) => order.id === payload.serviceOrderId)
      )
        nextErrors.serviceOrderId = 'Vui lòng chọn đơn dịch vụ thuộc đặt phòng này.'
    }
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) {
      event.currentTarget
        .querySelector<HTMLElement>(`[name="${Object.keys(nextErrors)[0]}"]`)
        ?.focus()
      return
    }
    const current = matchingIntent ?? {
      signature,
      payload: { ...payload, requestId: crypto.randomUUID() },
      booking: booking!,
      uncertain: false,
    }
    setIntents((previous) => new Map(previous).set(signature, current))
    setIntent(current)
    setInput((previous) => ({ ...previous, bookingId }))
    setChosen(true)
    submitting.current = true
    try {
      await mutation.mutateAsync(current.payload)
    } catch (error) {
      const status = isAxiosError(error) ? error.response?.status : undefined
      const failedIntent = {
        ...current,
        uncertain: current.uncertain || !status || status >= 500 || status === 408,
      }
      setIntents((previous) => new Map(previous).set(signature, failedIntent))
      setIntent(failedIntent)
      if (status === 400 || status === 404 || status === 409) void context.refetch()
    } finally {
      submitting.current = false
    }
  }

  const saved = (mutation.isSuccess ? intent : matchingIntent)?.booking
  return (
    <PageContainer>
      <PageHeader
        title="Báo sự cố"
        subtitle="Cho chúng tôi biết vấn đề. Khách sạn sẽ xem xét báo cáo trước khi giao xử lý."
      />
      {mutation.isSuccess ? (
        <div role="status" className="min-w-0 space-y-4 py-10">
          <EmptyState
            icon={CheckCircle2}
            title="Đã tiếp nhận báo cáo"
            body="Chờ xem xét. Khách sạn sẽ xem xét báo cáo trước khi giao xử lý."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                {typeof mutation.data.id === 'string' &&
                  /^[a-f\d]{24}$/i.test(mutation.data.id) && (
                    <Button asChild className="rounded-full">
                      <Link to={`/customer/issues/${mutation.data.id}`}>Xem báo cáo của tôi</Link>
                    </Button>
                  )}
                <Button asChild variant="outline" className="rounded-full">
                  <Link to="/customer/issues">Danh sách sự cố</Link>
                </Button>
                <Button
                  className="rounded-full"
                  onClick={() => {
                    mutation.reset()
                    setIntent(undefined)
                    setIntents(new Map())
                    setInput({ title: '', category: '', description: '', bookingId: '' })
                    setChosen(false)
                    setMode('booking')
                    setErrors({})
                    setPrefillCleared(true)
                    void context.refetch()
                  }}
                >
                  Báo sự cố khác
                </Button>
              </div>
            }
          />
          <Panel>
            <dl className="space-y-2 break-words text-sm">
              <dt className="font-semibold">Mã báo cáo</dt>
              <dd>{mutation.data.id}</dd>
              <dt className="font-semibold">Tiêu đề</dt>
              <dd>{mutation.data.title}</dd>
              <dt className="font-semibold">Đặt phòng</dt>
              <dd>{saved && bookingLabel(saved)}</dd>
              {intent?.payload.roomId && (
                <>
                  <dt className="font-semibold">Phòng</dt>
                  <dd>
                    Phòng{' '}
                    {saved?.rooms.find((room) => room.id === intent.payload.roomId)?.roomNumber}
                  </dd>
                </>
              )}
              {intent?.payload.serviceOrderId && (
                <>
                  <dt className="font-semibold">Đơn dịch vụ</dt>
                  <dd>
                    {
                      saved?.serviceOrders.find(
                        (order) => order.id === intent.payload.serviceOrderId,
                      )?.serviceName
                    }
                  </dd>
                </>
              )}
              <dt className="font-semibold">Thời điểm tiếp nhận</dt>
              <dd>{new Date(mutation.data.reportedAt).toLocaleString('vi-VN')}</dd>
            </dl>
          </Panel>
        </div>
      ) : (
        <Panel>
          {context.isPending && !intent ? (
            <div aria-label="Đang tải ngữ cảnh báo sự cố" className="grid max-w-2xl gap-4">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : (
            <>
              {context.isError && (
                <Alert tone="danger">
                  Không tải được ngữ cảnh báo sự cố.{' '}
                  <Button type="button" variant="outline" onClick={() => void context.refetch()}>
                    Thử lại
                  </Button>
                </Alert>
              )}
              {!context.isPending && !context.isError && !bookings.length && (
                <EmptyState
                  title="Chỉ dùng được khi đang lưu trú"
                  body="Bạn có thể báo sự cố khi đang lưu trú."
                />
              )}
              {(bookings.length > 0 || intent) && (
                <form
                  className="grid max-w-2xl gap-4"
                  noValidate
                  onSubmit={submit}
                  aria-busy={mutation.isPending}
                >
                  <p className="text-sm text-muted-foreground">
                    Chọn đặt phòng đang lưu trú và ngữ cảnh xảy ra sự cố. Khách sạn sẽ xem xét báo
                    cáo trước khi giao xử lý.
                  </p>
                  {invalidPrefill && (
                    <Alert tone="danger">
                      Liên kết chứa ngữ cảnh không hợp lệ. Vui lòng chọn lại đặt phòng và ngữ cảnh.
                    </Alert>
                  )}
                  <fieldset disabled={mutation.isPending} className="grid min-w-0 gap-4">
                    <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                      <FormField
                        htmlFor="issue-booking"
                        label="Đặt phòng"
                        required
                        error={errors.bookingId}
                      >
                        <NativeSelect
                          id="issue-booking"
                          name="bookingId"
                          required
                          value={bookingId}
                          aria-invalid={!!errors.bookingId}
                          aria-describedby={errors.bookingId ? 'issue-booking-error' : undefined}
                          onChange={(event) => update('bookingId', event.target.value)}
                        >
                          <option value="">Chọn đặt phòng</option>
                          {bookings.map((item) => (
                            <option key={item.id} value={item.id}>
                              {bookingLabel(item)}
                            </option>
                          ))}
                          {replay && !booking && saved && (
                            <option value={saved.id}>{bookingLabel(saved)}</option>
                          )}
                        </NativeSelect>
                      </FormField>
                      <FormField htmlFor="issue-mode" label="Ngữ cảnh" required>
                        <NativeSelect
                          id="issue-mode"
                          value={mode}
                          onChange={(event) => {
                            setMode(event.target.value as Mode)
                            setInput((previous) => ({
                              ...previous,
                              roomId: '',
                              serviceOrderId: '',
                            }))
                            setErrors({})
                            mutation.reset()
                          }}
                        >
                          <option value="booking">Đặt phòng</option>
                          <option value="room">Phòng</option>
                          <option value="service">Đơn dịch vụ</option>
                        </NativeSelect>
                      </FormField>
                    </div>
                    {mode === 'room' && (
                      <FormField htmlFor="issue-room" label="Phòng" required error={errors.roomId}>
                        <NativeSelect
                          id="issue-room"
                          name="roomId"
                          value={input.roomId ?? ''}
                          required
                          aria-invalid={!!errors.roomId}
                          aria-describedby={errors.roomId ? 'issue-room-error' : undefined}
                          onChange={(event) => update('roomId', event.target.value)}
                        >
                          <option value="">Chọn phòng</option>
                          {(booking ?? (replay ? saved : undefined))?.rooms.map((room) => (
                            <option key={room.id} value={room.id}>
                              Phòng {room.roomNumber}
                            </option>
                          ))}
                        </NativeSelect>
                      </FormField>
                    )}
                    {mode === 'service' && (
                      <FormField
                        htmlFor="issue-service"
                        label="Đơn dịch vụ"
                        required
                        error={errors.serviceOrderId}
                      >
                        <NativeSelect
                          id="issue-service"
                          name="serviceOrderId"
                          value={input.serviceOrderId ?? ''}
                          required
                          aria-invalid={!!errors.serviceOrderId}
                          aria-describedby={
                            errors.serviceOrderId ? 'issue-service-error' : undefined
                          }
                          onChange={(event) => update('serviceOrderId', event.target.value)}
                        >
                          <option value="">Chọn đơn dịch vụ</option>
                          {(booking ?? (replay ? saved : undefined))?.serviceOrders.map(
                            (order, index) => (
                              <option key={order.id} value={order.id}>
                                {index + 1}. {order.serviceName} ·{' '}
                                {reviewLabels[order.reviewStatus as keyof typeof reviewLabels] ??
                                  order.reviewStatus}{' '}
                                ·{' '}
                                {executionLabels[
                                  order.executionStatus as keyof typeof executionLabels
                                ] ?? order.executionStatus}
                              </option>
                            ),
                          )}
                        </NativeSelect>
                      </FormField>
                    )}
                    <FormField htmlFor="issue-title" label="Tiêu đề" required error={errors.title}>
                      <Input
                        id="issue-title"
                        name="title"
                        required
                        maxLength={200}
                        value={input.title}
                        aria-invalid={!!errors.title}
                        aria-describedby={errors.title ? 'issue-title-error' : undefined}
                        onChange={(event) => update('title', event.target.value)}
                      />
                    </FormField>
                    <FormField
                      htmlFor="issue-category"
                      label="Nhóm sự cố"
                      required
                      error={errors.category}
                    >
                      <NativeSelect
                        id="issue-category"
                        name="category"
                        required
                        value={input.category}
                        aria-invalid={!!errors.category}
                        aria-describedby={errors.category ? 'issue-category-error' : undefined}
                        onChange={(event) => update('category', event.target.value)}
                      >
                        {categories.map((category) => (
                          <option key={category} value={category}>
                            {category || 'Chọn nhóm sự cố'}
                          </option>
                        ))}
                      </NativeSelect>
                    </FormField>
                    <FormField
                      htmlFor="issue-description"
                      label="Mô tả"
                      required
                      error={errors.description}
                      hint="Mô tả sự cố, vị trí và thời điểm xảy ra (tối đa 5.000 ký tự). Tiêu đề tối đa 200 ký tự."
                    >
                      <Textarea
                        id="issue-description"
                        name="description"
                        required
                        rows={5}
                        maxLength={5000}
                        value={input.description}
                        aria-invalid={!!errors.description}
                        aria-describedby={
                          errors.description ? 'issue-description-error' : undefined
                        }
                        onChange={(event) => update('description', event.target.value)}
                      />
                    </FormField>
                    {mutation.isError && (
                      <Alert tone="danger">{errorMessage(mutation.error)}</Alert>
                    )}
                    <Button
                      type="submit"
                      disabled={
                        mutation.isPending ||
                        (!replay && (context.isFetching || context.isError || !bookings.length))
                      }
                      className="w-fit rounded-full"
                    >
                      Gửi báo cáo
                    </Button>
                    {mutation.isPending && (
                      <p role="status" className="text-sm text-muted-foreground">
                        Đang gửi báo cáo, vui lòng chờ xác nhận…
                      </p>
                    )}
                    {intent?.uncertain && (
                      <Button
                        type="button"
                        variant="outline"
                        className="w-fit rounded-full"
                        disabled={context.isFetching}
                        onClick={() => void context.refetch()}
                      >
                        Làm mới ngữ cảnh
                      </Button>
                    )}
                  </fieldset>
                </form>
              )}
            </>
          )}
        </Panel>
      )}
    </PageContainer>
  )
}
