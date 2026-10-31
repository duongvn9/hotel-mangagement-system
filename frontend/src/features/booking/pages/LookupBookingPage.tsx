import { useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { Button } from '@/components/Button'
import { TextField } from '@/components/TextField'

/**
 * Tra cứu đơn bằng mã cho khách vãng lai (chưa đăng nhập). Nhập mã định danh booking (ID)
 * và mã booking (vé) đã nhận qua email để mở trang chi tiết và thanh toán/huỷ.
 */
export function LookupBookingPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [lookupId, setLookupId] = useState(params.get('id') ?? '')
  const [lookupCode, setLookupCode] = useState(params.get('code') ?? '')

  function openLookup(event: FormEvent) {
    event.preventDefault()
    const id = lookupId.trim()
    if (!id) return
    const code = lookupCode.trim()
    navigate(`/booking/${id}${code ? `?code=${encodeURIComponent(code)}` : ''}`)
  }

  return (
    <section className="mx-auto max-w-container space-y-6 px-4 py-10 font-body">
      <div>
        <p className="text-xs font-semibold tracking-widest text-primary uppercase">Đặt phòng</p>
        <h1 className="font-display text-4xl font-semibold text-pearl-900">Tra cứu đặt phòng</h1>
        <p className="mt-2 text-sm text-stone-700">
          Dành cho khách chưa đăng nhập. Nhập mã định danh booking và mã booking (vé) đã nhận qua
          email để xem và thanh toán đơn.
        </p>
      </div>

      <form
        onSubmit={openLookup}
        className="max-w-xl space-y-4 rounded-lg border border-stone-300 bg-white p-6"
        aria-label="Tra cứu booking bằng mã"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <TextField
            label="Mã định danh booking (ID)"
            placeholder="vd: 6716..."
            value={lookupId}
            onChange={(event) => setLookupId(event.target.value)}
          />
          <TextField
            label="Mã booking (vé)"
            placeholder="BK..."
            value={lookupCode}
            onChange={(event) => setLookupCode(event.target.value)}
          />
        </div>
        <Button type="submit">Mở booking</Button>
      </form>
    </section>
  )
}
