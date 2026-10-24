import { useRef, useState } from 'react'
import { isAxiosError } from 'axios'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/Button'
import { TextField } from '@/components/TextField'
import { useAuth } from '@/features/auth/auth-context'
import { canCloseIssue, closeIssue, type IssueDetail } from './api'
import { issueKeys } from './hooks'

function closeError(error: unknown) {
  const status = isAxiosError(error) ? error.response?.status : undefined
  if (status === 400)
    return 'Kết luận không hợp lệ. Vui lòng nhập từ 1 đến 2000 ký tự sau khi bỏ khoảng trắng đầu và cuối.'
  if (status === 403) return 'Bạn không có quyền đóng sự cố này.'
  if (status === 404) return 'Không tìm thấy sự cố trong phạm vi truy cập của bạn.'
  if (status === 409)
    return 'Sự cố đã thay đổi hoặc chưa đủ điều kiện đóng. Đã yêu cầu tải lại trạng thái; hãy kiểm tra trước khi xác nhận lại.'
  return 'Không thể xác nhận kết quả đóng sự cố. Đã yêu cầu tải lại trạng thái; hãy kiểm tra trước khi thử lại.'
}

export function IssueClosure({ issue }: { issue: IssueDetail }) {
  const { me } = useAuth()
  const client = useQueryClient()
  const locked = useRef(false)
  const [conclusion, setConclusion] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState('')
  const eligible = canCloseIssue(issue)
  const mutation = useMutation({
    mutationFn: (value: string) => closeIssue(issue.id, { conclusion: value }),
    retry: false,
    onSuccess: (data) => {
      client.setQueryData(issueKeys.detail(me?.id, me?.role, issue.id), data)
      setConclusion('')
      setError('')
    },
    onError: (cause) => setError(closeError(cause)),
    onSettled: async () => {
      setConfirming(false)
      try {
        await client.invalidateQueries({ queryKey: issueKeys.scope(me?.id, me?.role) })
      } finally {
        locked.current = false
      }
    },
  })
  if (me?.role !== 'RECEPTIONIST' && me?.role !== 'MANAGER') return null
  const submit = () => {
    if (locked.current || mutation.isPending || !eligible || !confirming) return
    const value = conclusion.trim()
    if (!value || value.length > 2000) {
      setError('Vui lòng nhập kết luận từ 1 đến 2000 ký tự.')
      return
    }
    locked.current = true
    setError('')
    mutation.mutate(value)
  }
  return (
    <section className="space-y-4" aria-label="Đóng sự cố">
      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
      {eligible && !confirming && (
        <Button
          onClick={() => {
            setError('')
            setConfirming(true)
          }}
          disabled={mutation.isPending}
        >
          Đóng sự cố
        </Button>
      )}
      {eligible && confirming && (
        <section
          role="dialog"
          aria-modal="true"
          aria-label="Xác nhận đóng sự cố"
          className="space-y-4 rounded-lg border border-stone-300 bg-cream-50 p-4"
        >
          <h3 className="font-semibold">Xác nhận đóng sự cố</h3>
          <p>Máy chủ sẽ kiểm tra lại quyền và kết quả xử lý đã lưu trước khi đóng sự cố.</p>
          <TextField
            label="Kết luận đóng sự cố"
            value={conclusion}
            maxLength={2000}
            required
            disabled={mutation.isPending}
            onChange={(event) => setConclusion(event.target.value)}
          />
          <Button disabled={mutation.isPending} onClick={submit}>
            Xác nhận đóng
          </Button>
          <Button
            variant="secondary"
            disabled={mutation.isPending}
            onClick={() => {
              setConfirming(false)
              setError('')
            }}
          >
            Hủy
          </Button>
        </section>
      )}
      {mutation.isPending && <p role="status">Đang đóng và cập nhật trạng thái…</p>}
    </section>
  )
}
