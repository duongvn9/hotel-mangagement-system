import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { api } from '@/lib/api-client'
import { CheckoutInspection } from './components/CheckoutInspection'
import type { CheckoutInspectionView } from './api'

const inspectors = [
  { id: 's1', fullName: 'Lê Văn Dịch Vụ' },
  { id: 's2', fullName: 'Trần Thị Buồng Phòng' },
]

const view = (overrides: Partial<CheckoutInspectionView> = {}): CheckoutInspectionView => ({
  taskId: 't1',
  status: 'ASSIGNED',
  assigneeName: 'Lê Văn Dịch Vụ',
  requestedAt: '2026-11-10T04:00:00.000Z',
  ...overrides,
})

function mockGet(initial: CheckoutInspectionView | null) {
  let current = initial
  vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
    if (url === '/bookings/d1/checkout-inspection') return { data: { inspection: current } }
    if (url === '/front-desk/inspectors') return { data: { items: inspectors } }
    throw new Error(`unexpected GET ${url}`)
  })
  return {
    set: (next: CheckoutInspectionView | null) => {
      current = next
    },
  }
}

function renderSection() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <CheckoutInspection bookingId="d1" />
    </QueryClientProvider>,
  )
}

describe('Checkout inspection request', () => {
  it('lets the receptionist pick service staff and ask for an inspection', async () => {
    const state = mockGet(null)
    const post = vi.spyOn(api, 'post').mockImplementation(async () => {
      state.set(view())
      return { data: view() }
    })
    renderSection()

    const picker = await screen.findByLabelText('Nhân viên kiểm tra')
    await waitFor(() => expect(screen.getAllByRole('option').length).toBeGreaterThan(1))
    expect(screen.getByRole('option', { name: 'Trần Thị Buồng Phòng' })).toBeInTheDocument()
    const request = screen.getByRole('button', { name: 'Yêu cầu kiểm tra phòng' })
    expect(request).toBeDisabled()

    fireEvent.change(picker, { target: { value: 's1' } })
    fireEvent.change(screen.getByLabelText('Ghi chú cho người kiểm tra'), {
      target: { value: '  Khách báo vỡ ly ' },
    })
    fireEvent.click(request)

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/bookings/d1/checkout-inspection', {
        assigneeId: 's1',
        note: 'Khách báo vỡ ly',
      }),
    )
    expect(await screen.findByText(/Đang chờ Lê Văn Dịch Vụ kiểm tra/)).toBeInTheDocument()
  })

  it('omits the note when it is left empty', async () => {
    mockGet(null)
    const post = vi.spyOn(api, 'post').mockResolvedValue({ data: view() })
    renderSection()

    await waitFor(() => expect(screen.getAllByRole('option').length).toBeGreaterThan(1))
    fireEvent.change(await screen.findByLabelText('Nhân viên kiểm tra'), {
      target: { value: 's2' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Yêu cầu kiểm tra phòng' }))

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/bookings/d1/checkout-inspection', { assigneeId: 's2' }),
    )
  })

  it('shows who is checking while the work is still open, and reloads on request', async () => {
    const get = vi.spyOn(api, 'get')
    mockGet(view({ status: 'IN_PROGRESS' }))
    renderSection()

    expect(await screen.findByText(/Đang chờ Lê Văn Dịch Vụ kiểm tra/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Yêu cầu kiểm tra phòng' })).not.toBeInTheDocument()
    const before = get.mock.calls.length
    fireEvent.click(screen.getByRole('button', { name: 'Tải lại' }))
    await waitFor(() => expect(get.mock.calls.length).toBeGreaterThan(before))
  })

  it('shows the staff result once the inspection is completed', async () => {
    mockGet(
      view({
        status: 'COMPLETED',
        completedAt: '2026-11-10T05:00:00.000Z',
        workResult: 'Dùng 2 chai nước suối; vỡ 1 ly',
      }),
    )
    renderSection()

    expect(await screen.findByText(/Lê Văn Dịch Vụ đã kiểm tra xong/)).toBeInTheDocument()
    expect(screen.getByText('Dùng 2 chai nước suối; vỡ 1 ly')).toBeInTheDocument()
    expect(screen.getByText(/Ghi các khoản phí tương ứng/)).toBeInTheDocument()
  })

  it('offers a new request after a cancelled inspection', async () => {
    mockGet(view({ status: 'CANCELLED' }))
    renderSection()

    expect(
      await screen.findByRole('button', { name: 'Yêu cầu kiểm tra phòng' }),
    ).toBeInTheDocument()
  })

  it('shows the server error when the request is refused', async () => {
    mockGet(null)
    vi.spyOn(api, 'post').mockRejectedValue({
      isAxiosError: true,
      response: { status: 409, data: { message: 'An active task already exists for this work' } },
    })
    renderSection()

    await waitFor(() => expect(screen.getAllByRole('option').length).toBeGreaterThan(1))
    fireEvent.change(await screen.findByLabelText('Nhân viên kiểm tra'), {
      target: { value: 's1' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Yêu cầu kiểm tra phòng' }))

    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })
})
