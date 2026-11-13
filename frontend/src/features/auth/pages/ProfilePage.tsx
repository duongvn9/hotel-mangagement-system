import { useState, type FormEvent } from 'react'
import { AssetImage } from '@/components/AssetImage'
import { Button, Input } from '@/components/atoms'
import { Alert, FormField, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/molecules'
import { PageHeader, Panel } from '@/components/organisms'
import { getErrorMessage } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import { ROLE_LABELS, updateProfile } from '../api'
import { useAuth } from '../auth-context'

/** UC04 Update Profile: chỉ sửa họ tên, số điện thoại của chính mình (BR-ACC-06). Tab Mật khẩu: đặt/đổi mật khẩu. */
export function ProfilePage() {
  const { me, refresh, isDevMode } = useAuth()
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

  const profilePanel = (
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
  )

  return (
    <div className="mx-auto max-w-5xl px-5 py-10 lg:px-8">
      <PageHeader
        title="Hồ sơ của tôi"
        subtitle={`Đang đăng nhập với vai trò ${ROLE_LABELS[me.role] ?? me.role}`}
      />

      {isDevMode ? (
        profilePanel
      ) : (
        <Tabs defaultValue="profile">
          <TabsList className="rounded-full">
            <TabsTrigger className="rounded-full" value="profile">
              Hồ sơ
            </TabsTrigger>
            <TabsTrigger className="rounded-full" value="security">
              Mật khẩu
            </TabsTrigger>
          </TabsList>
          <TabsContent value="profile" className="mt-6">
            {profilePanel}
          </TabsContent>
          <TabsContent value="security" className="mt-6">
            <PasswordPanel />
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}

const EMPTY_PASSWORDS = { current: '', next: '', again: '' }

/** Chưa có mật khẩu (chỉ đăng nhập Google) thì đặt mới; đã có thì đổi, phải nhập mật khẩu hiện tại. */
function PasswordPanel() {
  const { hasPassword, setPassword } = useAuth()
  const [form, setForm] = useState(EMPTY_PASSWORDS)
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string }>()
  const [pending, setPending] = useState(false)
  // Giữ tiêu đề cũ trong lúc gửi để form không đổi giữa chừng khi hasPassword chuyển true.
  const [changing, setChanging] = useState(hasPassword)

  const update = (key: keyof typeof EMPTY_PASSWORDS) => (e: { target: { value: string } }) =>
    setForm({ ...form, [key]: e.target.value })

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (form.next !== form.again) {
      setMessage({ tone: 'danger', text: 'Mật khẩu nhập lại không khớp' })
      return
    }
    setMessage(undefined)
    setPending(true)
    try {
      await setPassword(form.next, changing ? form.current : undefined)
      setMessage({
        tone: 'success',
        text: changing
          ? 'Đã cập nhật mật khẩu'
          : 'Đã đặt mật khẩu. Từ giờ bạn có thể đăng nhập bằng email và mật khẩu.',
      })
      setForm(EMPTY_PASSWORDS)
      setChanging(true)
    } catch (error) {
      setMessage({
        tone: 'danger',
        text: error instanceof Error ? error.message : 'Không lưu được mật khẩu',
      })
    } finally {
      setPending(false)
    }
  }

  return (
    <Panel title={changing ? 'Đổi mật khẩu' : 'Đặt mật khẩu'} className="max-w-2xl">
      {!changing && (
        <p className="mb-4 text-sm text-muted-foreground">
          Tài khoản của bạn đang đăng nhập bằng Google. Đặt mật khẩu để đăng nhập thêm bằng email và
          mật khẩu.
        </p>
      )}

      {message && (
        <Alert tone={message.tone} className="mb-4">
          {message.text}
        </Alert>
      )}

      <form onSubmit={onSubmit} className="grid max-w-xl gap-4">
        {changing && (
          <FormField label="Mật khẩu hiện tại" htmlFor="currentPassword" required>
            <Input
              id="currentPassword"
              type="password"
              autoComplete="current-password"
              required
              value={form.current}
              onChange={update('current')}
            />
          </FormField>
        )}
        <FormField label="Mật khẩu mới" htmlFor="newPassword" required>
          <Input
            id="newPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            value={form.next}
            onChange={update('next')}
          />
        </FormField>
        <FormField label="Xác nhận mật khẩu mới" htmlFor="confirmPassword" required>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            value={form.again}
            onChange={update('again')}
          />
        </FormField>
        <Button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          className="w-fit rounded-full px-6"
        >
          {pending ? 'Đang lưu…' : changing ? 'Cập nhật mật khẩu' : 'Đặt mật khẩu'}
        </Button>
      </form>
    </Panel>
  )
}
