import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { api } from '@/lib/api-client'
import { BookingAttentionAlert } from './components/BookingAttentionAlert'

function renderAlert(props: { showLink?: boolean } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <BookingAttentionAlert {...props} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => vi.restoreAllMocks())

test('warns about the non-zero attention categories only', async () => {
  vi.spyOn(api, 'get').mockResolvedValue({
    data: { overdueCheckOut: 2, overdueCheckIn: 0, dueCheckOut: 1, dueCheckIn: 0 },
  })
  renderAlert()
  expect(await screen.findByText('Quá hạn trả phòng')).toBeInTheDocument()
  expect(screen.getByText('Trả phòng hôm nay')).toBeInTheDocument()
  expect(screen.queryByText('Quá hạn nhận phòng')).not.toBeInTheDocument()
  expect(screen.queryByText('Nhận phòng hôm nay')).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Xem danh sách đặt phòng' })).toHaveAttribute(
    'href',
    '/reception/bookings',
  )
  expect(api.get).toHaveBeenCalledWith('/bookings/attention')
})

test('hides the list link when showLink is false', async () => {
  vi.spyOn(api, 'get').mockResolvedValue({
    data: { overdueCheckOut: 1, overdueCheckIn: 0, dueCheckOut: 0, dueCheckIn: 0 },
  })
  renderAlert({ showLink: false })
  expect(await screen.findByText('Quá hạn trả phòng')).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Xem danh sách đặt phòng' })).not.toBeInTheDocument()
})

test('renders nothing when no booking needs attention', async () => {
  vi.spyOn(api, 'get').mockResolvedValue({
    data: { overdueCheckOut: 0, overdueCheckIn: 0, dueCheckOut: 0, dueCheckIn: 0 },
  })
  const { container } = renderAlert()
  await waitFor(() => expect(api.get).toHaveBeenCalledWith('/bookings/attention'))
  expect(container).toBeEmptyDOMElement()
})
