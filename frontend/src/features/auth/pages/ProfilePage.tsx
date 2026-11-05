import { useState, type FormEvent } from 'react'
import { AssetImage } from '@/components/AssetImage'
import { Button, Input } from '@/components/atoms'
import { FormField } from '@/components/molecules'
import { PageHeader, Panel } from '@/components/organisms'
import { getErrorMessage } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import { ROLE_LABELS, updateProfile } from '../api'
import { useAuth } from '../auth-context'

/** UC04 Update Profile: chỉ sửa họ tên, số điện thoại của chính mình (BR-ACC-06). */
export function ProfilePage() {
  const { me, refresh } = useAuth()
  const [fullName, setFullName] = useState(me?.fullName ?? '')
  const [phone, setPhone] = useState(me?.phone ?? '')
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string }>()
  const [pending, setPending] = useState(false)

  if (!me) return null

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setMessage(undefined)
    setPending(true)
    try {
      // Chuỗi rỗng = xoá số điện thoại.
      await updateProfile({ fullName: fullName.trim(), phone: phone.trim() })
      await refresh()
      setMessage({ tone: 'success', text: 'Đã lưu hồ sơ' })
    } catch (error) {
      setMessage({ tone: 'danger', text: getErrorMessage(error, 'Không lưu được hồ sơ') })
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-5 py-10 lg:px-8">
      <PageHeader
        title="Hồ sơ của tôi"
        subtitle={`Đang đăng nhập với vai trò ${ROLE_LABELS[me.role] ?? me.role}`}
      />

      <Panel title="Thông tin cá nhân" className="max-w-2xl">
        <div className="mb-6 flex items-center gap-4">
          <AssetImage
            path={me.avatarUrl}
            name={me.fullName}
            className="size-16 rounded-full object-cover"
          />
          <div>
            <p className="font-semibold text-foreground">{me.fullName}</p>
            <p className="text-sm text-muted-foreground">{me.email}</p>
            <span className="mt-1 inline-block text-xs font-medium text-primary">
              {ROLE_LABELS[me.role] ?? me.role}
            </span>
          </div>
        </div>

        {message && (
          <div
            role="alert"
            className={cn(
              'mb-4 rounded-xl border p-4 text-sm',
              message.tone === 'success'
                ? 'border-success/20 bg-success/10 text-success'
                : 'border-destructive/20 bg-destructive/10 text-destructive',
            )}
          >
            {message.text}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          <FormField label="Họ và tên" htmlFor="fullName" required>
            <Input
              id="fullName"
              required
              minLength={2}
              maxLength={100}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </FormField>

          <FormField label="Số điện thoại" htmlFor="phone">
            <Input
              id="phone"
              type="tel"
              pattern="0[0-9]{9}"
              title="10 chữ số, bắt đầu bằng 0"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </FormField>

          <div className="pt-2">
            <Button
              type="submit"
              disabled={pending}
              aria-busy={pending}
              className="rounded-full px-6"
            >
              {pending ? 'Đang lưu…' : 'Lưu thay đổi'}
            </Button>
          </div>
        </form>
      </Panel>
    </div>
  )
}
