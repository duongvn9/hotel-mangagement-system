import { isAxiosError } from 'axios'
import { useRef, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router'
import { CheckCircle2 } from 'lucide-react'
import { Button, Input, NativeSelect, Textarea } from '@/components/atoms'
import { EmptyState, FormField } from '@/components/molecules'
import { PageContainer, PageHeader, Panel } from '@/components/organisms'
import { validateIssue, type IssueErrors, type IssueInput } from '../api'
import { useReportIssue } from '../hooks'

const categories = [
  { value: '', label: 'Chọn nhóm sự cố' },
  { value: 'Phòng và tiện nghi', label: 'Phòng và tiện nghi' },
  { value: 'Vệ sinh', label: 'Vệ sinh' },
  { value: 'Khác', label: 'Khác' },
]

function errorMessage(error: unknown) {
  const status = isAxiosError(error) ? error.response?.status : undefined
  if (status === 400)
    return 'Thông tin chưa hợp lệ hoặc đặt phòng không còn phù hợp để báo sự cố. Vui lòng kiểm tra lại.'
  if (status === 403)
    return 'Bạn không có quyền gửi báo cáo này. Vui lòng kiểm tra tài khoản đang đăng nhập.'
  if (status === 404)
    return 'Không tìm thấy đặt phòng hoặc phòng phù hợp với tài khoản của bạn. Vui lòng kiểm tra lại mã.'
  if (status === 401) return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại trước khi gửi.'
  return 'Chưa nhận được xác nhận gửi báo cáo. Vui lòng kiểm tra kết nối hoặc liên hệ lễ tân để xác nhận trước khi gửi lại.'
}

export function ReportIssuePage() {
  const [params] = useSearchParams()
  const [input, setInput] = useState<IssueInput>(() => ({
    title: '',
    category: '',
    description: '',
    bookingId: params.get('bookingId') ?? '',
    roomId: params.get('roomId') ?? '',
  }))
  const [errors, setErrors] = useState<IssueErrors>({})
  const submitting = useRef(false)
  const mutation = useReportIssue()
  const serviceContext = params.has('serviceOrderId')
  const update = (key: keyof IssueInput, value: string) => {
    setInput((previous) => ({ ...previous, [key]: value }))
    setErrors((previous) => ({ ...previous, [key]: undefined }))
    mutation.reset()
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting.current || mutation.isSuccess || serviceContext) return
    const nextErrors = validateIssue(input)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) {
      const name = Object.keys(nextErrors)[0]
      event.currentTarget.querySelector<HTMLElement>(`[name="${name}"]`)?.focus()
      return
    }
    submitting.current = true
    try {
      await mutation.mutateAsync(input)
    } catch {
      return
    } finally {
      submitting.current = false
    }
  }

  return (
    <PageContainer>
      <PageHeader
        title="Báo sự cố"
        subtitle="Cho chúng tôi biết vấn đề, chúng tôi sẽ cử người đến xử lý."
      />
      {mutation.isSuccess ? (
        <div role="status" className="min-w-0 space-y-4 py-10">
          <EmptyState
            icon={CheckCircle2}
            title="Đã tiếp nhận báo cáo"
            body="Chờ xem xét. Khách sạn sẽ xem xét báo cáo trước khi giao xử lý."
          />
          <Panel>
            <dl className="space-y-2 break-words text-sm">
              <dt className="font-semibold">Mã báo cáo</dt>
              <dd>{mutation.data.id}</dd>
              <dt className="font-semibold">Tiêu đề</dt>
              <dd>{mutation.data.title}</dd>
              <dt className="font-semibold">Mã đặt phòng</dt>
              <dd>{mutation.data.bookingId}</dd>
              {mutation.data.roomId && (
                <>
                  <dt className="font-semibold">Mã phòng</dt>
                  <dd>{mutation.data.roomId}</dd>
                </>
              )}
              <dt className="font-semibold">Thời điểm tiếp nhận</dt>
              <dd>{new Date(mutation.data.reportedAt).toLocaleString('vi-VN')}</dd>
            </dl>
          </Panel>
        </div>
      ) : (
        <Panel>
          <div
            id="issue-context"
            className="mb-6 max-w-2xl space-y-3 text-sm text-muted-foreground"
          >
            <p>
              Hãy cung cấp mã đặt phòng của chính bạn còn hoạt động, chưa bị hủy. Không bắt buộc đã
              nhận phòng.
            </p>
            <p>
              Hiện chưa có danh sách đặt phòng để chọn. Vui lòng nhập mã đặt phòng (không phải số
              phòng); nếu chưa biết mã, hãy liên hệ lễ tân. Mã phòng là tùy chọn và phải thuộc đặt
              phòng đó.
            </p>
            <p>
              Mã từ liên kết chỉ được điền sẵn, chưa được xác minh. Khách sạn sẽ kiểm tra đặt phòng,
              phòng và quyền sở hữu khi bạn gửi.
            </p>
          </div>
          {serviceContext && (
            <p role="alert" className="mb-6 text-danger">
              Chưa hỗ trợ báo sự cố theo đơn dịch vụ. Không thể gửi từ liên kết này. Vui lòng mở
              “Báo sự cố” trong menu để báo theo đặt phòng hoặc liên hệ lễ tân.
            </p>
          )}
          <form
            className="grid max-w-2xl gap-4"
            noValidate
            onSubmit={submit}
            aria-describedby="issue-context"
            aria-busy={mutation.isPending}
          >
            <fieldset
              disabled={mutation.isPending || serviceContext}
              className="grid min-w-0 gap-4"
            >
              <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                <FormField htmlFor="issue-booking" label="Mã đặt phòng" required>
                  <Input
                    id="issue-booking"
                    name="bookingId"
                    required
                    value={input.bookingId}
                    aria-invalid={!!errors.bookingId}
                    aria-describedby={errors.bookingId ? 'booking-error' : undefined}
                    onChange={(e) => update('bookingId', e.target.value)}
                  />
                  {errors.bookingId && (
                    <p id="booking-error" role="alert" className="text-xs text-destructive">
                      {errors.bookingId}
                    </p>
                  )}
                </FormField>
                <FormField htmlFor="issue-room" label="Mã phòng (không bắt buộc)">
                  <Input
                    id="issue-room"
                    name="roomId"
                    value={input.roomId}
                    aria-invalid={!!errors.roomId}
                    aria-describedby={errors.roomId ? 'room-error' : undefined}
                    onChange={(e) => update('roomId', e.target.value)}
                  />
                  {errors.roomId && (
                    <p id="room-error" role="alert" className="text-xs text-destructive">
                      {errors.roomId}
                    </p>
                  )}
                </FormField>
              </div>
              <FormField htmlFor="issue-title" label="Tiêu đề" required>
                <Input
                  id="issue-title"
                  name="title"
                  required
                  maxLength={200}
                  value={input.title}
                  aria-invalid={!!errors.title}
                  aria-describedby={errors.title ? 'title-error' : undefined}
                  onChange={(e) => update('title', e.target.value)}
                />
                {errors.title && (
                  <p id="title-error" role="alert" className="text-xs text-destructive">
                    {errors.title}
                  </p>
                )}
              </FormField>
              <FormField htmlFor="issue-category" label="Nhóm sự cố" required>
                <NativeSelect
                  id="issue-category"
                  name="category"
                  required
                  value={input.category}
                  aria-invalid={!!errors.category}
                  aria-describedby={errors.category ? 'category-error' : undefined}
                  onChange={(e) => update('category', e.target.value)}
                >
                  {categories.map((category) => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </NativeSelect>
                {errors.category && (
                  <p id="category-error" role="alert" className="text-xs text-destructive">
                    {errors.category}
                  </p>
                )}
              </FormField>
              <FormField htmlFor="issue-description" label="Mô tả" required>
                <Textarea
                  id="issue-description"
                  name="description"
                  required
                  rows={5}
                  maxLength={5000}
                  value={input.description}
                  onChange={(e) => update('description', e.target.value)}
                  aria-invalid={!!errors.description}
                  aria-describedby="description-help description-error"
                />
                <p id="description-help" className="text-xs text-muted-foreground">
                  Mô tả sự cố, vị trí và thời điểm xảy ra (tối đa 5.000 ký tự). Tiêu đề tối đa 200
                  ký tự.
                </p>
                <p id="description-error" className="text-xs text-destructive">
                  {errors.description}
                </p>
              </FormField>
              {mutation.isError && (
                <p role="alert" className="text-sm text-danger">
                  {errorMessage(mutation.error)}
                </p>
              )}
              <Button type="submit" disabled={mutation.isPending} className="w-fit rounded-full">
                Gửi báo cáo
              </Button>
              {mutation.isPending && (
                <p role="status" className="text-sm text-muted-foreground">
                  Đang gửi báo cáo, vui lòng chờ xác nhận…
                </p>
              )}
            </fieldset>
          </form>
        </Panel>
      )}
    </PageContainer>
  )
}
