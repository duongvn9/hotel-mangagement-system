import { useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { Button, Input } from '@/components/atoms'
import { Alert, FormField } from '@/components/molecules'
import { getErrorMessage } from '@/lib/api-client'
import { useResolveBookingCode } from '../hooks'

/**
 * Tra cứu đơn cho khách vãng lai (chưa đăng nhập): chỉ cần nhập mã booking (vé) đã nhận qua
 * email. Hệ thống tra ra đơn tương ứng rồi mở trang chi tiết để xem/thanh toán/huỷ.
 */
export function LookupBookingPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [lookupCode, setLookupCode] = useState(params.get('code') ?? '')
  const resolve = useResolveBookingCode()

  async function openLookup(event: FormEvent) {
    event.preventDefault()
    const code = lookupCode.trim()
    if (!code) return
    try {
      const { id } = await resolve.mutateAsync(code)
      navigate(`/booking/${id}?code=${encodeURIComponent(code)}`)
    } catch {
      // Lỗi hiển thị qua resolve.isError bên dưới.
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-5 py-16 lg:px-8">
      <div className="grid gap-10 md:grid-cols-2 md:items-start">
        <div>
          <p className="text-xs font-semibold tracking-widest text-primary uppercase">Đặt phòng</p>
          <h1 className="mt-2 font-display text-5xl">Tra cứu đặt phòng</h1>
          <p className="mt-3 text-muted-foreground">
            Dành cho khách chưa đăng nhập. Nhập mã booking (vé) đã nhận qua email để xem và thanh
            toán đơn.
          </p>

          <form
            onSubmit={openLookup}
            className="mt-8 grid gap-4"
            aria-label="Tra cứu booking bằng mã"
          >
            <FormField label="Mã booking (vé)" htmlFor="lookupCode" required>
              <Input
                id="lookupCode"
                placeholder="BK..."
                autoComplete="off"
                value={lookupCode}
                onChange={(event) => setLookupCode(event.target.value)}
              />
            </FormField>

            {resolve.isError && (
              <Alert tone="danger">
                {getErrorMessage(
                  resolve.error,
                  'Không tìm thấy đơn với mã này. Vui lòng kiểm tra lại mã booking trong email.',
                )}
              </Alert>
            )}

            <div className="pt-2">
              <Button
                type="submit"
                className="rounded-full px-8"
                disabled={!lookupCode.trim() || resolve.isPending}
                aria-busy={resolve.isPending}
              >
                {resolve.isPending ? 'Đang tìm đơn…' : 'Mở booking'}
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
