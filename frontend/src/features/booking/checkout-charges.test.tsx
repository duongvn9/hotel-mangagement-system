import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { api } from '@/lib/api-client'
import { ME, renderWithAuth } from '@/features/auth/test-utils'
import { bookingRoutes } from './routes'
import type { BookingCharges, BookingListItem, SameDayList } from './api'
import { newRequestId, todayISO } from './utils'

const receptionist = { ...ME, id: 'u2', email: 'reception@hms.local', role: 'RECEPTIONIST' }

const row = (id: string, code: string, status: string, room: string): BookingListItem => ({
  id,
  code,
  status,
  guestName: `Khách ${code}`,
  guestEmail: `${code.toLowerCase()}@example.test`,
  guestPhone: '0900000001',
  rooms: [{ id: `room-${id}`, roomNumber: room, roomTypeName: 'Deluxe' }],
  checkIn: '2099-01-09T17:00:00.000Z',
  checkOut: '2099-01-11T17:00:00.000Z',
  adultCount: 2,
  childCount: 1,
  source: 'ONLINE',
  roomTotal: 2_000_000,
  createdAt: '2099-01-01T00:00:00.000Z',
  walkIn: false,
})

const list = (): SameDayList => ({
  date: todayISO(),
  summary: {
    arrivals: { total: 1, awaitingDeposit: 0, ready: 0, checkedIn: 1 },
    departures: { total: 2, awaitingCheckOut: 1, checkedOut: 1 },
  },
  arrivals: [row('a1', 'ARI', 'CHECKED_IN', '103')],
  departures: [row('d1', 'DPI', 'CHECKED_IN', '201'), row('d2', 'DPO', 'CHECKED_OUT', '202')],
})

const charges = (items: { reason: string; amount: number }[] = []): BookingCharges => {
  const additional = items.reduce((sum, item) => sum + item.amount, 0)
  return {
    bookingId: 'd1',
    code: 'DPI',
    status: 'CHECKED_IN',
    invoiceStatus: 'PARTIALLY_PAID',
    totals: {
      roomTotal: 2_000_000,
      serviceTotal: 0,
      additionalTotal: additional,
      discountTotal: 0,
      taxTotal: 0,
      totalAmount: 2_000_000 + additional,
      depositPaid: 600_000,
      finalPaid: 0,
      balanceDue: 1_400_000 + additional,
    },
    charges: items.map((item) => ({ type: 'ADDITIONAL', ...item })),
  }
}

function renderPage() {
  return renderWithAuth(bookingRoutes, {
    path: '/reception/front-desk',
    auth: { me: receptionist, status: 'authenticated' },
  })
}

function mockGet(initial: BookingCharges) {
  let current = initial
  const get = vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
    if (url === '/front-desk/same-day') return { data: list() }
    if (url === '/bookings/d1/charges') return { data: current }
    throw new Error(`unexpected GET ${url}`)
  })
  return {
    get,
    set: (next: BookingCharges) => {
      current = next
    },
  }
}

const departure = () => within(screen.getByRole('listitem', { name: 'DPI' }))

async function openPanel() {
  renderPage()
  await screen.findByRole('heading', { name: 'Khách đi (2)' })
  fireEvent.click(departure().getByRole('button', { name: 'Phụ phí' }))
}

function fill(amount: string, reason: string) {
  fireEvent.change(departure().getByLabelText(/Số tiền/), { target: { value: amount } })
  fireEvent.change(departure().getByLabelText(/Lý do/), { target: { value: reason } })
}

describe('newRequestId', () => {
  it('returns ids the API accepts and never repeats', () => {
    const first = newRequestId()
    expect(first).toMatch(/^[A-Za-z0-9_-]{8,64}$/)
    expect(newRequestId()).not.toBe(first)
  })
})

describe('Additional charges from the same-day list', () => {
  it('offers the charges panel only to guests who are checked in and about to leave', async () => {
    mockGet(charges())
    renderPage()
    await screen.findByRole('heading', { name: 'Khách đi (2)' })
    expect(screen.getAllByRole('button', { name: 'Phụ phí' })).toHaveLength(1)
    expect(departure().getByRole('button', { name: 'Phụ phí' })).toBeInTheDocument()
  })

  it('shows recorded charges and the invoice totals', async () => {
    mockGet(
      charges([
        { reason: 'Minibar', amount: 150_000 },
        { reason: 'Đền bù khăn', amount: 50_000 },
      ]),
    )
    await openPanel()

    expect(await departure().findByText('Minibar')).toBeInTheDocument()
    expect(departure().getByText('Đền bù khăn')).toBeInTheDocument()
    expect(departure().getByText(/Phụ phí: 200\.000/)).toBeInTheDocument()
    expect(departure().getByText(/Còn phải trả: 1\.600\.000/)).toBeInTheDocument()
  })

  it('says so when there are no charges yet', async () => {
    mockGet(charges())
    await openPanel()
    expect(await departure().findByText('Chưa có phụ phí.')).toBeInTheDocument()
  })

  it('records a charge, refreshes the list and clears the form', async () => {
    const state = mockGet(charges())
    const post = vi.spyOn(api, 'post').mockImplementation(async () => {
      state.set(charges([{ reason: 'Minibar', amount: 150_000 }]))
      return { data: {} }
    })
    await openPanel()
    await departure().findByText('Chưa có phụ phí.')

    fill('150000', '  Minibar ')
    fireEvent.click(departure().getByRole('button', { name: 'Thêm phụ phí' }))

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/bookings/d1/charges', {
        amount: 150000,
        reason: 'Minibar',
        requestId: expect.stringMatching(/^[A-Za-z0-9_-]{8,64}$/),
      }),
    )
    expect(await departure().findByText('Minibar')).toBeInTheDocument()
    expect(departure().getByLabelText(/Số tiền/)).toHaveValue(null)
    expect(departure().getByLabelText(/Lý do/)).toHaveValue('')
  })

  it('needs a positive amount and a reason before saving', async () => {
    mockGet(charges())
    const post = vi.spyOn(api, 'post')
    await openPanel()
    await departure().findByText('Chưa có phụ phí.')
    const save = departure().getByRole('button', { name: 'Thêm phụ phí' })

    expect(save).toBeDisabled()
    fill('0', 'Minibar')
    expect(save).toBeDisabled()
    fill('1000', '   ')
    expect(save).toBeDisabled()
    fill('1000', 'Minibar')
    expect(save).toBeEnabled()
    expect(post).not.toHaveBeenCalled()
  })

  it('retries with the same request id after a failure, then uses a new one', async () => {
    const state = mockGet(charges())
    const post = vi
      .spyOn(api, 'post')
      .mockRejectedValueOnce({
        isAxiosError: true,
        response: { status: 500, data: { message: 'Boom' } },
      })
      .mockImplementation(async () => {
        state.set(charges([{ reason: 'Minibar', amount: 150_000 }]))
        return { data: {} }
      })
    await openPanel()
    await departure().findByText('Chưa có phụ phí.')

    fill('150000', 'Minibar')
    fireEvent.click(departure().getByRole('button', { name: 'Thêm phụ phí' }))
    expect(await departure().findByRole('alert')).toBeInTheDocument()
    fireEvent.click(departure().getByRole('button', { name: 'Thêm phụ phí' }))
    await departure().findByText('Minibar')

    fill('50000', 'Giặt ủi')
    fireEvent.click(departure().getByRole('button', { name: 'Thêm phụ phí' }))
    await waitFor(() => expect(post).toHaveBeenCalledTimes(3))

    const ids = post.mock.calls.map((call) => (call[1] as { requestId: string }).requestId)
    expect(ids[1]).toBe(ids[0])
    expect(ids[2]).not.toBe(ids[0])
  })

  it('shows an error when the charges cannot be loaded', async () => {
    vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
      if (url === '/front-desk/same-day') return { data: list() }
      throw { isAxiosError: true, response: { status: 500, data: { message: 'Boom' } } }
    })
    await openPanel()
    expect(await departure().findByRole('alert')).toBeInTheDocument()
  })
})
