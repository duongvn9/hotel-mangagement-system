import { AssetImage } from '@/components/AssetImage'
import { useState, type FormEvent } from 'react'
import { Alert } from '@/components/Alert'
import { Button } from '@/components/Button'
import { TextField } from '@/components/TextField'
import { getErrorMessage } from '@/lib/api-client'
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
    <section className="mx-auto w-full max-w-md px-4 py-16">
      <h1 className="font-display text-4xl font-semibold text-pearl-900">Hồ sơ của tôi</h1>
      <AssetImage
        path={me.avatarUrl}
        name={me.fullName}
        className="mt-4 size-16 rounded-full object-cover"
      />
      <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
        <dt className="text-stone-700">Email</dt>
        <dd className="text-pearl-900">{me.email}</dd>
        <dt className="text-stone-700">Vai trò</dt>
        <dd className="text-pearl-900">{ROLE_LABELS[me.role] ?? me.role}</dd>
      </dl>

      <form onSubmit={onSubmit} className="mt-8 space-y-5">
        {message && <Alert tone={message.tone}>{message.text}</Alert>}
        <TextField
          label="Họ và tên"
          required
          minLength={2}
          maxLength={100}
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />
        <TextField
          label="Số điện thoại"
          type="tel"
          pattern="0[0-9]{9}"
          title="10 chữ số, bắt đầu bằng 0"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <Button type="submit" loading={pending}>
          Lưu thay đổi
        </Button>
      </form>
    </section>
  )
}
