import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { api } from '@/lib/api-client'
import { BookingAttentionAlert } from './components/BookingAttentionAlert'
import type { AttentionKind } from './attention'

function renderAlert(
  props: {
    showLink?: boolean
    selected?: AttentionKind | null
    onSelect?: (kind: AttentionKind | null) => void
  } = {},
) {
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

const COUNTS = { overdueCheckOut: 2, overdueCheckIn: 0, dueCheckOut: 1, dueCheckIn: 8 }

test('shows plain chips, not buttons, when nothing handles a selection', async () => {
  vi.spyOn(api, 'get').mockResolvedValue({ data: COUNTS })
  renderAlert()
  expect(await screen.findByText('Quá hạn trả phòng')).toBeInTheDocument()
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
})

test('makes each chip a toggle that reports the kind it stands for', async () => {
  vi.spyOn(api, 'get').mockResolvedValue({ data: COUNTS })
  const onSelect = vi.fn()
  renderAlert({ onSelect })

  const chip = await screen.findByRole('button', { name: /Nhận phòng hôm nay\s*8/ })
  expect(screen.getAllByRole('button')).toHaveLength(3)
  expect(chip).toHaveAttribute('aria-pressed', 'false')
  fireEvent.click(chip)
  expect(onSelect).toHaveBeenCalledWith('dueCheckIn')
  fireEvent.click(screen.getByRole('button', { name: /Quá hạn trả phòng\s*2/ }))
  expect(onSelect).toHaveBeenLastCalledWith('overdueCheckOut')
})

test('marks the selected chip as pressed and clears it when clicked again', async () => {
  vi.spyOn(api, 'get').mockResolvedValue({ data: COUNTS })
  const onSelect = vi.fn()
  renderAlert({ onSelect, selected: 'dueCheckOut' })

  const selected = await screen.findByRole('button', { name: /Trả phòng hôm nay\s*1/ })
  expect(selected).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: /Nhận phòng hôm nay\s*8/ })).toHaveAttribute(
    'aria-pressed',
    'false',
  )
  fireEvent.click(selected)
  expect(onSelect).toHaveBeenCalledWith(null)
})
