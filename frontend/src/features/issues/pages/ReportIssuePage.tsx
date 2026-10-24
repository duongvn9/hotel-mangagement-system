import { isAxiosError } from 'axios'
import { useRef, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router'
import { Button } from '@/components/Button'
import { SelectField } from '@/components/SelectField'
import { TextField } from '@/components/TextField'
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
    <section className="mx-auto w-full max-w-2xl px-4 py-12 sm:py-16">
      <h1 className="font-display text-4xl font-semibold">Báo sự cố</h1>
      {mutation.isSuccess ? (
        <div role="status" className="mt-6 space-y-4 rounded border border-stone-300 bg-white p-6">
          <h2 className="font-display text-2xl">Đã tiếp nhận báo cáo</h2>
          <p>Chờ xem xét. Khách sạn sẽ xem xét báo cáo trước khi giao xử lý.</p>
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
        </div>
      ) : (
        <>
          <div id="issue-context" className="my-6 space-y-3 text-sm text-stone-700">
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
            noValidate
            onSubmit={submit}
            aria-describedby="issue-context"
            aria-busy={mutation.isPending}
          >
            <fieldset disabled={mutation.isPending || serviceContext} className="min-w-0 space-y-5">
              <TextField
                name="bookingId"
                label="Mã đặt phòng"
                required
                value={input.bookingId}
                error={errors.bookingId}
                onChange={(e) => update('bookingId', e.target.value)}
              />
              <TextField
                name="roomId"
                label="Mã phòng (không bắt buộc)"
                value={input.roomId}
                error={errors.roomId}
                onChange={(e) => update('roomId', e.target.value)}
              />
              <TextField
                name="title"
                label="Tiêu đề"
                required
                maxLength={200}
                value={input.title}
                error={errors.title}
                onChange={(e) => update('title', e.target.value)}
              />
              <div>
                <SelectField
                  name="category"
                  label="Nhóm sự cố"
                  required
                  options={categories}
                  value={input.category}
                  aria-invalid={!!errors.category}
                  aria-describedby={errors.category ? 'category-error' : undefined}
                  onChange={(e) => update('category', e.target.value)}
                />
                {errors.category && (
                  <p id="category-error" className="mt-1 text-xs text-danger">
                    {errors.category}
                  </p>
                )}
              </div>
              <div>
                <label
                  htmlFor="issue-description"
                  className="mb-2 block text-xs font-semibold tracking-wider text-stone-700 uppercase"
                >
                  Mô tả <span className="text-danger">*</span>
                </label>
                <textarea
                  id="issue-description"
                  name="description"
                  required
                  rows={6}
                  maxLength={5000}
                  value={input.description}
                  onChange={(e) => update('description', e.target.value)}
                  aria-invalid={!!errors.description}
                  aria-describedby="description-help description-error"
                  className="w-full rounded border border-stone-300 bg-white p-4 text-sm focus:border-primary"
                />
                <p id="description-help" className="text-xs text-stone-700">
                  Mô tả sự cố, vị trí và thời điểm xảy ra (tối đa 5.000 ký tự). Tiêu đề tối đa 200
                  ký tự.
                </p>
                <p id="description-error" className="mt-1 text-xs text-danger">
                  {errors.description}
                </p>
              </div>
              {mutation.isError && (
                <p role="alert" className="text-sm text-danger">
                  {errorMessage(mutation.error)}
                </p>
              )}
              <Button type="submit" loading={mutation.isPending} className="w-full sm:w-auto">
                Gửi báo cáo
              </Button>
              {mutation.isPending && (
                <p role="status" className="text-sm text-stone-700">
                  Đang gửi báo cáo, vui lòng chờ xác nhận…
                </p>
              )}
            </fieldset>
          </form>
        </>
      )}
    </section>
  )
}
