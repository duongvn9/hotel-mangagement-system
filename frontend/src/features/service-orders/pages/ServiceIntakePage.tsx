import { useRef, useState, type FormEvent } from 'react'
import { isAxiosError } from 'axios'
import { Link } from 'react-router'
import { Button, Input, NativeSelect, Skeleton, StatusBadge, Textarea } from '@/components/atoms'
import { Alert, EmptyState, FormField } from '@/components/molecules'
import { PageContainer, PageHeader, Panel } from '@/components/organisms'
import { useAuth } from '@/features/auth/auth-context'
import { getErrorMessage } from '@/lib/api-client'
import { dateTime, estimateAmount, money, reviewLabels } from '../api'
import { useIntake, useIntakeChoices, type IntakeInput } from '../intake'

const currentTime = () => Date.now()

export function ServiceIntakePage() {
  const { me } = useAuth()
  const staff = me?.role === 'SERVICE_STAFF'
  const back = staff ? '/staff/service-history' : '/staff/service-orders'
  const [bookingId, setBookingId] = useState('')
  const [serviceId, setServiceId] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [roomId, setRoomId] = useState('')
  const [requesterName, setRequesterName] = useState('')
  const [requestedTime, setRequestedTime] = useState('')
  const [notes, setNotes] = useState('')
  const [mode, setMode] = useState<IntakeInput['intakeMode']>('UNPERFORMED')
  const [actualPerformerId, setActualPerformerId] = useState('')
  const [actualCompletedAt, setActualCompletedAt] = useState('')
  const [completionDetails, setCompletionDetails] = useState('')
  const [validation, setValidation] = useState('')
  const [intent, setIntent] = useState<IntakeInput | null>(null)
  const sending = useRef(false)
  const completed = staff && mode === 'COMPLETED_ON_SITE'
  const { contexts, catalog, performers } = useIntakeChoices(completed)
  const mutation = useIntake()
  const booking = contexts.data?.items.find((item) => item.id === bookingId)
  const service = catalog.data?.items.find((item) => item.id === serviceId)
  const amount = service ? estimateAmount(service, Number(quantity)) : null
  const locked = Boolean(intent) || mutation.isPending
  const response = isAxiosError<{ message?: unknown }>(mutation.error)
    ? mutation.error.response
    : undefined
  const safeToCorrect =
    mutation.isError &&
    ((response?.status === 400 &&
      ['requestedTime must be future and within stay', 'Invalid integer VND amount'].includes(
        String(response.data?.message),
      )) ||
      (response?.status === 409 &&
        response.data?.message === 'Service is not available for ordering'))
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (sending.current || mutation.isPending || mutation.isSuccess) return
    let payload = intent
    if (!payload) {
      const time = requestedTime ? new Date(requestedTime) : undefined
      const finished = actualCompletedAt ? new Date(actualCompletedAt) : undefined
      if (
        !booking ||
        !service ||
        amount === null ||
        (roomId && !booking.rooms.some((room) => room.id === roomId))
      ) {
        setValidation('Chọn đặt phòng, dịch vụ và số lượng nguyên hợp lệ.')
        return
      }
      if (
        (time &&
          (!Number.isFinite(time.getTime()) ||
            time.getTime() <= currentTime() ||
            time < new Date(booking.checkIn) ||
            time >= new Date(booking.checkOut))) ||
        (booking.status === 'CONFIRMED' && (!time || time < new Date(booking.checkIn)))
      ) {
        setValidation(
          'Thời gian yêu cầu phải trong kỳ lưu trú và sau hiện tại; đặt phòng chưa nhận cần hẹn giờ.',
        )
        return
      }
      if (
        completed &&
        (!performers.data?.items.some((item) => item.id === actualPerformerId) ||
          !finished ||
          !Number.isFinite(finished.getTime()) ||
          finished.getTime() > currentTime() ||
          finished < new Date(booking.checkIn) ||
          finished >= new Date(booking.checkOut) ||
          !completionDetails.trim())
      ) {
        setValidation(
          'Chọn người thực hiện, ngày hoàn thành trong kỳ lưu trú không sau hiện tại và kết quả thực hiện.',
        )
        return
      }
      payload = {
        bookingId,
        serviceId,
        quantity: Number(quantity),
        requestId: crypto.randomUUID(),
        intakeMode: completed ? 'COMPLETED_ON_SITE' : 'UNPERFORMED',
        ...(roomId ? { roomId } : {}),
        ...(requesterName.trim() ? { requesterName: requesterName.trim() } : {}),
        ...(time ? { requestedTime: time.toISOString() } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        ...(completed
          ? {
              actualPerformerId,
              actualCompletedAt: finished!.toISOString(),
              completionDetails: completionDetails.trim(),
            }
          : {}),
      }
      setIntent(payload)
    }
    setValidation('')
    sending.current = true
    try {
      await mutation.mutateAsync(payload)
    } catch {
      return
    } finally {
      sending.current = false
    }
  }
  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title="Ghi nhận yêu cầu dịch vụ"
        subtitle="Ghi nhận theo yêu cầu của khách; đơn giá lấy từ danh mục máy chủ."
        actions={
          <Button asChild variant="outline" className="rounded-full">
            <Link to={back}>Quay lại dịch vụ</Link>
          </Button>
        }
      />
      {mutation.isSuccess ? (
        <Panel title="Kết quả ghi nhận">
          <div className="space-y-4 text-sm">
            <Alert tone="success">
              {staff ? 'Đã ghi nhận, chờ lễ tân duyệt.' : reviewLabels[mutation.data.reviewStatus]}
            </Alert>
            <p>Thời gian yêu cầu: {dateTime(mutation.data.requestedTime)}</p>
            <Button asChild className="rounded-full">
              <Link
                to={
                  staff
                    ? `${back}/reports/${encodeURIComponent(mutation.data.id)}`
                    : `${back}/${encodeURIComponent(mutation.data.id)}`
                }
              >
                Xem yêu cầu
              </Link>
            </Button>
          </div>
        </Panel>
      ) : (
        <Panel title="Thông tin yêu cầu">
          {(contexts.isPending || catalog.isPending) && (
            <div role="status">
              <Skeleton className="h-32 w-full" />
              Đang tải dữ liệu…
            </div>
          )}
          {(contexts.isError || catalog.isError) && (
            <Alert tone="danger">
              Không thể tải dữ liệu.{' '}
              <Button
                variant="outline"
                onClick={() => {
                  void contexts.refetch()
                  void catalog.refetch()
                }}
              >
                Thử lại
              </Button>
            </Alert>
          )}
          {contexts.isSuccess && contexts.data.items.length === 0 && (
            <EmptyState title="Không có đặt phòng đủ điều kiện." />
          )}
          {catalog.isSuccess && catalog.data.items.length === 0 && (
            <EmptyState title="Không có dịch vụ đang hoạt động." />
          )}
          {contexts.isSuccess && catalog.isSuccess && (
            <form onSubmit={(event) => void submit(event)} className="grid gap-4 sm:grid-cols-2">
              <fieldset disabled={locked} className="contents">
                <FormField label="Đặt phòng" htmlFor="intake-booking">
                  <NativeSelect
                    id="intake-booking"
                    value={bookingId}
                    required
                    onChange={(event) => {
                      setBookingId(event.target.value)
                      setRoomId('')
                    }}
                  >
                    <option value="">Chọn đặt phòng</option>
                    {contexts.data.items.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.code} · {item.guestName}
                      </option>
                    ))}
                  </NativeSelect>
                </FormField>
                {booking && (
                  <div className="space-y-2 text-sm break-words">
                    <p>
                      Khách: {booking.guestName} {booking.guestPhone}
                    </p>
                    <StatusBadge status={booking.status} />
                    <p>Nhận phòng: {dateTime(booking.checkIn)}</p>
                    <p>Trả phòng: {dateTime(booking.checkOut)}</p>
                    <p>
                      Phòng:{' '}
                      {booking.rooms
                        .map((room) => room.roomNumber)
                        .filter(Boolean)
                        .join(', ') || 'Chưa có phòng'}
                    </p>
                  </div>
                )}
                <FormField label="Phòng yêu cầu" htmlFor="intake-room">
                  <NativeSelect
                    id="intake-room"
                    value={roomId}
                    onChange={(event) => setRoomId(event.target.value)}
                  >
                    <option value="">Không chỉ định</option>
                    {booking?.rooms.map((room) => (
                      <option key={room.id} value={room.id}>
                        {room.roomNumber || 'Chưa có số phòng'}
                      </option>
                    ))}
                  </NativeSelect>
                </FormField>
                <FormField label="Người yêu cầu" htmlFor="intake-requester">
                  <Input
                    id="intake-requester"
                    value={requesterName}
                    maxLength={200}
                    onChange={(event) => setRequesterName(event.target.value)}
                  />
                </FormField>
                <FormField label="Dịch vụ" htmlFor="intake-service">
                  <NativeSelect
                    id="intake-service"
                    required
                    value={serviceId}
                    onChange={(event) => setServiceId(event.target.value)}
                  >
                    <option value="">Chọn dịch vụ</option>
                    {catalog.data.items.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} · {money(item.unitPriceVND)} / {item.unit}
                      </option>
                    ))}
                  </NativeSelect>
                </FormField>
                <FormField label="Số lượng" htmlFor="intake-quantity">
                  <Input
                    id="intake-quantity"
                    type="number"
                    min={1}
                    max={Number.MAX_SAFE_INTEGER}
                    step={1}
                    required
                    value={quantity}
                    onChange={(event) => setQuantity(event.target.value)}
                  />
                </FormField>
                <p className="text-sm">
                  Tổng phí dự kiến: {amount === null ? 'Chọn dịch vụ' : money(amount)}. Không xác
                  nhận thanh toán.
                </p>
                <FormField
                  label="Thời gian yêu cầu"
                  htmlFor="intake-time"
                  hint="Đặt phòng đã xác nhận nhưng chưa nhận cần hẹn trong kỳ lưu trú."
                >
                  <Input
                    id="intake-time"
                    type="datetime-local"
                    required={booking?.status === 'CONFIRMED'}
                    value={requestedTime}
                    onChange={(event) => setRequestedTime(event.target.value)}
                  />
                </FormField>
                <FormField label="Ghi chú" htmlFor="intake-notes">
                  <Textarea
                    id="intake-notes"
                    maxLength={2000}
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                  />
                </FormField>
                {staff && (
                  <FormField label="Hình thức ghi nhận" htmlFor="intake-mode">
                    <NativeSelect
                      id="intake-mode"
                      value={mode}
                      onChange={(event) => setMode(event.target.value as IntakeInput['intakeMode'])}
                    >
                      <option value="UNPERFORMED">Chưa thực hiện</option>
                      <option value="COMPLETED_ON_SITE">Đã thực hiện tại chỗ</option>
                    </NativeSelect>
                  </FormField>
                )}
                {completed && (
                  <>
                    {performers.isPending && <p role="status">Đang tải người thực hiện…</p>}
                    {performers.isError && (
                      <Alert tone="danger">
                        Không thể tải người thực hiện.{' '}
                        <Button type="button" onClick={() => void performers.refetch()}>
                          Tải lại người thực hiện
                        </Button>
                      </Alert>
                    )}
                    {performers.isSuccess && !performers.data.items.length && (
                      <EmptyState title="Không có người thực hiện đang hoạt động." />
                    )}
                    <FormField label="Người thực hiện thực tế" htmlFor="intake-performer">
                      <NativeSelect
                        id="intake-performer"
                        required
                        value={actualPerformerId}
                        onChange={(event) => setActualPerformerId(event.target.value)}
                      >
                        <option value="">Chọn người thực hiện</option>
                        {performers.data?.items.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.displayName}
                          </option>
                        ))}
                      </NativeSelect>
                    </FormField>
                    <FormField label="Thời điểm hoàn thành thực tế" htmlFor="intake-completed">
                      <Input
                        id="intake-completed"
                        type="datetime-local"
                        required
                        value={actualCompletedAt}
                        onChange={(event) => setActualCompletedAt(event.target.value)}
                      />
                    </FormField>
                    <FormField label="Kết quả thực hiện" htmlFor="intake-result">
                      <Textarea
                        id="intake-result"
                        maxLength={2000}
                        required
                        value={completionDetails}
                        onChange={(event) => setCompletionDetails(event.target.value)}
                      />
                    </FormField>
                  </>
                )}
              </fieldset>
              {validation && <Alert tone="danger">{validation}</Alert>}
              {mutation.isError && (
                <Alert tone="danger">
                  {getErrorMessage(
                    mutation.error,
                    'Chưa xác nhận kết quả. Giữ nguyên nội dung và thử lại cùng mã yêu cầu.',
                  )}
                </Alert>
              )}
              {intent && (
                <p role="status" className="text-sm">
                  {safeToCorrect
                    ? 'Máy chủ từ chối trước khi tạo yêu cầu. Bạn có thể sửa nội dung và gửi lại bằng mã mới.'
                    : 'Yêu cầu có thể đã được tạo. Nội dung đã gửi được khóa để thử lại an toàn; chưa xác nhận chấp nhận hay ghi phí. Kiểm tra yêu cầu trong danh sách trước khi tạo đơn khác.'}
                </p>
              )}
              {safeToCorrect && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-fit rounded-full"
                  onClick={() => {
                    setIntent(null)
                    mutation.reset()
                    setValidation('')
                    void contexts.refetch()
                    void catalog.refetch()
                  }}
                >
                  Sửa yêu cầu chưa được tạo
                </Button>
              )}
              <Button
                type="submit"
                className="w-fit rounded-full"
                disabled={
                  mutation.isPending ||
                  (!intent &&
                    (!booking ||
                      !service ||
                      amount === null ||
                      (completed && !performers.isSuccess)))
                }
              >
                {mutation.isPending
                  ? 'Đang ghi nhận…'
                  : intent
                    ? 'Thử lại cùng nội dung'
                    : 'Ghi nhận yêu cầu'}
              </Button>
            </form>
          )}
        </Panel>
      )}
    </PageContainer>
  )
}
