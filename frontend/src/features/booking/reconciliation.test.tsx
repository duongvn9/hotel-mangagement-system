import { fireEvent, screen, waitFor } from '@testing-library/react'
import { api } from '@/lib/api-client'
import { ME, renderWithAuth } from '@/features/auth/test-utils'
import { bookingRoutes } from './routes'

const item = {
  id: 'p1',
  transactionRef: 'TXN-LATE',
  purpose: 'DEPOSIT' as const,
  amount: 600_000,
  providerTransactionRef: '123456',
  paidAt: '2099-01-10T05:00:00.000Z',
  bookingId: 'b2',
  bookingCode: 'BK777',
  bookingStatus: 'EXPIRED',
  createdAt: '2099-01-10T04:00:00.000Z',
}

describe('ReconciliationPage (manager)', () => {
  afterEach(() => vi.restoreAllMocks())

  it('opens the booking in the staff booking page, not the guest page', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({ data: { items: [item], total: 1 } })
    renderWithAuth(bookingRoutes, {
      path: '/manager/payments/reconciliation',
      auth: { me: ME, status: 'authenticated' },
    })

    expect(await screen.findByRole('link', { name: 'Xem booking' })).toHaveAttribute(
      'href',
      '/reception/bookings/BK777',
    )
  })

  it('lists a flagged payment and clears it after the manager marks it handled', async () => {
    let resolved = false
    vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
      if (url === '/payments/reconciliation')
        return { data: { items: resolved ? [] : [item], total: resolved ? 0 : 1 } }
      throw new Error(`unexpected GET ${url}`)
    })
    const post = vi.spyOn(api, 'post').mockImplementation(async (url: string) => {
      if (url === '/payments/p1/reconcile') {
        resolved = true
        return { data: { ...item, needsReconciliation: false } }
      }
      throw new Error(`unexpected POST ${url}`)
    })

    renderWithAuth(bookingRoutes, {
      path: '/manager/payments/reconciliation',
      auth: { me: ME, status: 'authenticated' },
    })

    expect(await screen.findByText('BK777')).toBeInTheDocument()
    // StatusBadge hiển thị nhãn ngắn qua label(): EXPIRED → "Hết hạn".
    expect(screen.getByText('Hết hạn')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Ghi chú đối soát', { exact: false }), {
      target: { value: 'Đã hoàn qua VNPay' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Đánh dấu đã xử lý' }))

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/payments/p1/reconcile', { note: 'Đã hoàn qua VNPay' }),
    )
    expect(await screen.findByText(/Không có khoản nào cần đối soát/)).toBeInTheDocument()
  })
})
