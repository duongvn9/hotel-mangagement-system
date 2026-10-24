import { useRef, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { Button } from '@/components/Button'
import { TextField } from '@/components/TextField'
import { useAuth } from '@/features/auth/auth-context'
import { issueKeys } from './hooks'
import {
  getServiceIssueContext,
  normalizeServiceIssue,
  reportServiceIssue,
  validateServiceIssue,
  type ServiceIssueInput,
} from './service-issue-api'

function errorMessage(error: unknown) {
  const status = isAxiosError(error) ? error.response?.status : undefined
  const messages: Record<number, string> = {
    400: 'Thông tin báo cáo không hợp lệ. Vui lòng kiểm tra nội dung.',
    401: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
    403: 'Bạn không có quyền báo sự cố cho công việc này.',
    404: 'Không tìm thấy công việc hoặc ngữ cảnh dịch vụ phù hợp.',
    409: 'Điều kiện báo sự cố đã thay đổi hoặc mã yêu cầu không còn phù hợp. Đã yêu cầu tải lại công việc và ngữ cảnh; hãy kiểm tra trước khi thử lại.',
  }
  return (
    messages[status ?? 0] ??
    'Chưa nhận được xác nhận báo cáo. Vui lòng thử lại cùng nội dung khi kết nối ổn định; hệ thống giữ nguyên mã yêu cầu để tránh gửi trùng.'
  )
}

export function ServiceTaskIssueReport({
  taskId,
  eligible,
}: {
  taskId: string
  eligible: boolean
}) {
  const { me } = useAuth()
  const client = useQueryClient()
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState<ServiceIssueInput>({
    title: '',
    category: '',
    description: '',
  })
  const [errors, setErrors] = useState<Partial<Record<keyof ServiceIssueInput, string>>>({})
  const submitting = useRef(false)
  const attempts = useRef(new Map<string, string>())
  const contextKey = ['service-issue-context', me?.id, me?.role, taskId]
  const context = useQuery({
    queryKey: contextKey,
    queryFn: () => getServiceIssueContext(taskId),
    enabled: open && eligible,
    retry: false,
  })
  const mutation = useMutation({
    mutationFn: ({ payload, requestId }: { payload: ServiceIssueInput; requestId: string }) =>
      reportServiceIssue(taskId, payload, requestId),
    retry: false,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: [...issueKeys.scope(me?.id, me?.role), 'list'] })
    },
    onError: (error) => {
      const status = isAxiosError(error) ? error.response?.status : undefined
      if (status === 403 || status === 404 || status === 409) {
        void client.invalidateQueries({ queryKey: ['assigned-task', me?.id, taskId], exact: true })
        void client.invalidateQueries({ queryKey: ['assigned-tasks', me?.id] })
        void client.invalidateQueries({ queryKey: contextKey, exact: true })
      }
    },
  })
  const ready =
    eligible &&
    context.isSuccess &&
    !context.isFetching &&
    context.data.taskId === taskId &&
    context.data.taskStatus === 'IN_PROGRESS'
  const status = isAxiosError(mutation.error) ? mutation.error.response?.status : undefined
  const blocked = status === 401 || status === 403 || status === 404

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting.current || mutation.isPending || mutation.isSuccess || !ready || blocked) return
    const validation = validateServiceIssue(input)
    setErrors(validation)
    if (Object.keys(validation).length) {
      event.currentTarget
        .querySelector<HTMLElement>(`[name="${Object.keys(validation)[0]}"]`)
        ?.focus()
      return
    }
    const payload = normalizeServiceIssue(input)
    const fingerprint = JSON.stringify(payload)
    const requestId = attempts.current.get(fingerprint) ?? crypto.randomUUID()
    attempts.current.set(fingerprint, requestId)
    submitting.current = true
    try {
      await mutation.mutateAsync({ payload, requestId })
    } catch {
      return
    } finally {
      submitting.current = false
    }
  }

  if (!open && !eligible) return null
  return (
    <section
      className="min-w-0 space-y-4 rounded-lg border border-stone-300 bg-white p-4 sm:p-6"
      aria-label="Báo sự cố dịch vụ"
    >
      {!open ? (
        <Button onClick={() => setOpen(true)}>Báo sự cố dịch vụ</Button>
      ) : (
        <>
          <h2 className="text-xl font-semibold">Báo sự cố dịch vụ</h2>
          {mutation.isSuccess ? (
            <div role="status" className="space-y-3 break-words">
              <h3 className="font-semibold text-success">Đã tiếp nhận báo cáo — Chờ xem xét</h3>
              <p>Mã báo cáo: {mutation.data.id}</p>
              <p>Tiêu đề: {mutation.data.title}</p>
              <p>
                Thời điểm tiếp nhận: {new Date(mutation.data.reportedAt).toLocaleString('vi-VN')}
              </p>
              <p>
                Báo cáo không thay đổi tiến độ công việc hay đơn dịch vụ, không tự tạo công việc xử
                lý.
              </p>
              {eligible && (
                <Button
                  onClick={() => {
                    attempts.current.clear()
                    mutation.reset()
                    setInput({ title: '', category: '', description: '' })
                    setErrors({})
                    void context.refetch()
                  }}
                >
                  Báo sự cố khác
                </Button>
              )}
            </div>
          ) : (
            <>
              {context.isFetching && <p role="status">Đang tải ngữ cảnh dịch vụ…</p>}
              {context.isError && (
                <p role="alert" className="text-danger">
                  {errorMessage(context.error)}
                </p>
              )}
              {context.isSuccess && (
                <dl className="grid gap-3 text-sm sm:grid-cols-2">
                  {[
                    ['Công việc dịch vụ', context.data.taskTitle],
                    ['Mã công việc dịch vụ', context.data.taskId],
                    ['Trạng thái công việc dịch vụ', context.data.taskStatus],
                    ['Mã đơn dịch vụ', context.data.serviceOrderId],
                    ['Dịch vụ', context.data.service.name],
                    ['Đơn vị', context.data.service.unit],
                    ['Mã đặt phòng dịch vụ', context.data.booking.code],
                  ].map(([label, value]) => (
                    <div key={label} className="min-w-0">
                      <dt className="font-semibold">{label}</dt>
                      <dd className="break-words">{value}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {!eligible && (
                <p role="alert">
                  Công việc không còn đủ điều kiện gửi báo cáo mới. Nội dung và yêu cầu đang gửi vẫn
                  được giữ nguyên.
                </p>
              )}
              {context.isSuccess && context.data.taskStatus !== 'IN_PROGRESS' && (
                <p role="alert">Chỉ báo sự cố khi đang thực hiện công việc dịch vụ.</p>
              )}
              <Button
                variant="secondary"
                disabled={mutation.isPending || context.isFetching}
                onClick={() => void context.refetch()}
              >
                Tải lại ngữ cảnh dịch vụ
              </Button>
              <form
                noValidate
                onSubmit={submit}
                aria-busy={mutation.isPending}
                className="space-y-4"
              >
                <fieldset
                  disabled={mutation.isPending || !ready || blocked}
                  className="min-w-0 space-y-4"
                >
                  {(['title', 'category'] as const).map((key) => (
                    <TextField
                      key={key}
                      name={key}
                      label={key === 'title' ? 'Tiêu đề sự cố dịch vụ' : 'Nhóm sự cố dịch vụ'}
                      required
                      value={input[key]}
                      error={errors[key]}
                      onChange={(event) => {
                        setInput((previous) => ({ ...previous, [key]: event.target.value }))
                        setErrors((previous) => ({ ...previous, [key]: undefined }))
                      }}
                    />
                  ))}
                  <div>
                    <label
                      htmlFor="service-issue-description"
                      className="mb-2 block text-sm font-semibold"
                    >
                      Mô tả sự cố dịch vụ (bắt buộc)
                    </label>
                    <textarea
                      id="service-issue-description"
                      name="description"
                      required
                      rows={6}
                      value={input.description}
                      aria-invalid={Boolean(errors.description)}
                      aria-describedby="service-issue-help service-issue-error"
                      onChange={(event) => {
                        setInput((previous) => ({ ...previous, description: event.target.value }))
                        setErrors((previous) => ({ ...previous, description: undefined }))
                      }}
                      className="w-full min-w-0 rounded border border-stone-300 bg-white p-3 text-sm focus-visible:outline-2 focus-visible:outline-focus"
                    />
                    <p id="service-issue-help" className="text-sm text-stone-700">
                      Sau khi bỏ khoảng trắng đầu và cuối: tiêu đề tối đa 200, nhóm sự cố 100, mô tả
                      5000 ký tự. Không cung cấp thông tin cá nhân của khách.
                    </p>
                    {errors.description && (
                      <p id="service-issue-error" role="alert" className="text-sm text-danger">
                        {errors.description}
                      </p>
                    )}
                  </div>
                  <Button type="submit" loading={mutation.isPending}>
                    Gửi báo cáo sự cố dịch vụ
                  </Button>
                </fieldset>
                {mutation.isPending && (
                  <p role="status">Đang gửi báo cáo, vui lòng chờ xác nhận…</p>
                )}
                {mutation.isError && (
                  <p role="alert" className="text-danger">
                    {errorMessage(mutation.error)}
                  </p>
                )}
              </form>
            </>
          )}
        </>
      )}
    </section>
  )
}
