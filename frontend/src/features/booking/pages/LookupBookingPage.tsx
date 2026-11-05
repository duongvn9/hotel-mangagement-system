import { useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { Button, Input } from '@/components/atoms'
import { FormField } from '@/components/molecules'

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
    <div className="mx-auto max-w-5xl px-5 py-16 lg:px-8">
      <div className="grid gap-10 md:grid-cols-2 md:items-start">
        <div>
          <p className="text-xs font-semibold tracking-widest text-primary uppercase">Đặt phòng</p>
          <h1 className="mt-2 font-display text-5xl">Tra cứu đặt phòng</h1>
          <p className="mt-3 text-muted-foreground">
            Dành cho khách chưa đăng nhập. Nhập mã định danh booking và mã booking (vé) đã nhận qua
            email để xem và thanh toán đơn.
          </p>

          <form
            onSubmit={openLookup}
            className="mt-8 grid gap-4"
            aria-label="Tra cứu booking bằng mã"
          >
            <FormField label="Mã định danh booking (ID)" htmlFor="lookupId" required>
              <Input
                id="lookupId"
                placeholder="vd: 6716..."
                value={lookupId}
                onChange={(event) => setLookupId(event.target.value)}
              />
            </FormField>

            <FormField label="Mã booking (vé)" htmlFor="lookupCode">
              <Input
                id="lookupCode"
                placeholder="BK..."
                value={lookupCode}
                onChange={(event) => setLookupCode(event.target.value)}
              />
            </FormField>

            <div className="pt-2">
              <Button type="submit" className="rounded-full px-8">
                Mở booking
              </Button>
            </div>
          </form>
        </div>

        <div className="card-soft space-y-4 p-8">
          <h2 className="font-display text-2xl font-semibold">Cần hỗ trợ?</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Nếu bạn không tìm thấy mã booking trong email hoặc cần hỗ trợ thay đổi lịch trình, vui
            lòng liên hệ quầy lễ tân để được hỗ trợ 24/7.
          </p>
          <div className="space-y-1 rounded-xl border border-border bg-surface p-4 text-xs text-muted-foreground">
            <p>Hotline: 0258 3888 999</p>
            <p>Email: reservation@grandemily.com</p>
          </div>
        </div>
      </div>
    </div>
  )
}
