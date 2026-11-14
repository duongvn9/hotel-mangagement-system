import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { api } from '@/lib/api-client'
import { ME, renderWithAuth } from '@/features/auth/test-utils'
import { bookingRoutes } from './routes'
import type { BookingCharges, BookingListItem, ChargeCategory, SameDayList } from './api'
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

const charges = (
  items: { reason: string; amount: number; category?: ChargeCategory }[] = [],
): BookingCharges => {
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

const catalog = [
  { id: 'svc-laundry', name: 'Giặt ủi', unit: 'kg', billable: true, unitPriceVND: 50_000 },
  { id: 'svc-water', name: 'Nước suối', unit: 'chai', billable: true, unitPriceVND: 20_000 },
  { id: 'svc-wifi', name: 'Wifi', unit: '', billable: false, unitPriceVND: 0 },
  { id: 'svc-spa', name: 'Spa chưa có giá', unit: '', billable: true, unitPriceVND: null },
]

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
    if (url === '/bookings/service-catalog') return { data: { items: catalog } }
    if (url === '/bookings/d1/checkout-inspection') return { data: { inspection: null } }
    if (url === '/front-desk/inspectors') return { data: { items: [] } }
    throw new Error(`unexpected GET ${url}`)
  })
  return {
    get,
    set: (next: BookingCharges) => {
      current = next
    },
  }
}

const departure = () => within(screen.getByRole('dialog'))

async function openPanel() {
  renderPage()
  fireEvent.click(await screen.findByRole('tab', { name: 'Trả phòng' }))
  await screen.findByRole('heading', { name: 'Khách đi (2)' })
  fireEvent.click(
    within(screen.getByRole('listitem', { name: 'DPI' })).getByRole('button', {
      name: 'Trả phòng',
    }),
  )
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
    fireEvent.click(await screen.findByRole('tab', { name: 'Trả phòng' }))
    await screen.findByRole('heading', { name: 'Khách đi (2)' })
    expect(screen.getAllByRole('button', { name: 'Trả phòng' })).toHaveLength(1)
    expect(
      within(screen.getByRole('listitem', { name: 'DPI' })).getByRole('button', {
        name: 'Trả phòng',
      }),
    ).toBeInTheDocument()
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

  it('shows snapshot description, quantity, unit price and the unchanged line total', async () => {
    const data = charges()
    data.charges = [
      {
        type: 'SERVICE',
        sourceId: '507f1f77bcf86cd799439011',
        reason: 'Service order 507f1f77bcf86cd799439011',
        amount: 150_000,
        serviceName: 'Giặt ủi lịch sử',
        quantity: 3,
        unitPriceVND: 50_000,
      },
    ]
    mockGet(data)
    await openPanel()
    const recorded = within(await departure().findByRole('list', { name: 'Phụ phí đã ghi' }))
    expect(recorded.getByText('Giặt ủi lịch sử')).toBeInTheDocument()
    expect(recorded.getByText('Số lượng: 3 · Đơn giá: 50.000 ₫')).toBeInTheDocument()
    expect(recorded.getByText('150.000 ₫')).toBeInTheDocument()
    expect(recorded.queryByText(data.charges[0].reason)).not.toBeInTheDocument()
  })

  it('keeps original descriptions and amounts without inventing missing snapshot details', async () => {
    const data = charges()
    data.charges = [
      { type: 'SERVICE', reason: 'Service order missing', amount: 150_000 },
      { type: 'SERVICE', reason: 'Giặt ủi x3 (kg)', amount: 150_000 },
      { type: 'ADDITIONAL', reason: 'Vỡ ly', amount: 30_000, category: 'DAMAGE' },
    ]
    mockGet(data)
    await openPanel()
    const recorded = within(await departure().findByRole('list', { name: 'Phụ phí đã ghi' }))
    expect(recorded.getByText('Service order missing')).toBeInTheDocument()
    expect(recorded.getByText('Giặt ủi x3 (kg)')).toBeInTheDocument()
    expect(recorded.getByText('Vỡ ly')).toBeInTheDocument()
    expect(recorded.getByText('Hư hỏng')).toBeInTheDocument()
    expect(recorded.queryByText(/Số lượng:|Đơn giá:/)).not.toBeInTheDocument()
    expect(recorded.getAllByText('150.000 ₫')).toHaveLength(2)
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

  it('allows additional charges after a FINAL payment while checked in', async () => {
    const paid = charges()
    paid.totals.finalPaid = 1_400_000
    paid.totals.balanceDue = 0
    paid.invoiceStatus = 'PAID'
    mockGet(paid)
    const post = vi.spyOn(api, 'post').mockResolvedValue({ data: {} })
    await openPanel()
    await departure().findByText('Chưa có phụ phí.')
    fill('20000', 'Late minibar')
    fireEvent.click(departure().getByRole('button', { name: 'Thêm phụ phí' }))
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/bookings/d1/charges', {
        amount: 20000,
        reason: 'Late minibar',
        requestId: expect.any(String),
      }),
    )
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

describe('Adding a catalog service from the same-day list', () => {
  const chooseService = (id: string, quantity?: string) => {
    fireEvent.change(departure().getByLabelText(/Dịch vụ \/ sản phẩm/), { target: { value: id } })
    if (quantity !== undefined) {
      fireEvent.change(departure().getByLabelText(/Số lượng/), { target: { value: quantity } })
    }
  }

  it('shows the service total in the invoice summary', async () => {
    const withService = charges()
    withService.totals.serviceTotal = 150_000
    mockGet(withService)
    await openPanel()
    expect(await departure().findByText(/Dịch vụ: 150\.000/)).toBeInTheDocument()
  })

  it('offers only active services that have a price, with the unit price', async () => {
    mockGet(charges())
    await openPanel()
    await departure().findByText('Chưa có phụ phí.')

    const picker = await departure().findByLabelText(/Dịch vụ \/ sản phẩm/)
    await waitFor(() => expect(within(picker).getAllByRole('option').length).toBeGreaterThan(1))
    const names = within(picker)
      .getAllByRole('option')
      .map((option) => option.textContent)
    expect(names.some((name) => name?.includes('Giặt ủi') && name.includes('50.000'))).toBe(true)
    expect(names.some((name) => name?.includes('Nước suối'))).toBe(true)
    expect(names.some((name) => name?.includes('Wifi'))).toBe(false)
    expect(names.some((name) => name?.includes('Spa chưa có giá'))).toBe(false)
  })

  it('records the chosen service and quantity, refreshes the list and resets the form', async () => {
    const state = mockGet(charges())
    const post = vi.spyOn(api, 'post').mockImplementation(async () => {
      state.set(charges([{ reason: 'Giặt ủi x3 (kg)', amount: 150_000 }]))
      return { data: {} }
    })
    await openPanel()
    await departure().findByText('Chưa có phụ phí.')
    await waitFor(() =>
      expect(
        within(departure().getByLabelText(/Dịch vụ \/ sản phẩm/)).getAllByRole('option').length,
      ).toBeGreaterThan(1),
    )

    chooseService('svc-laundry', '3')
    fireEvent.click(departure().getByRole('button', { name: 'Thêm dịch vụ' }))

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/bookings/d1/charges/services', {
        serviceId: 'svc-laundry',
        quantity: 3,
        requestId: expect.stringMatching(/^[A-Za-z0-9_-]{8,64}$/),
      }),
    )
    expect(await departure().findByText('Giặt ủi x3 (kg)')).toBeInTheDocument()
    expect(departure().getByLabelText(/Dịch vụ \/ sản phẩm/)).toHaveValue('')
    expect(departure().getByLabelText(/Số lượng/)).toHaveValue(1)
  })

  it('needs a service and a whole quantity between 1 and 99', async () => {
    mockGet(charges())
    const post = vi.spyOn(api, 'post')
    await openPanel()
    await departure().findByText('Chưa có phụ phí.')
    await waitFor(() =>
      expect(
        within(departure().getByLabelText(/Dịch vụ \/ sản phẩm/)).getAllByRole('option').length,
      ).toBeGreaterThan(1),
    )
    const add = departure().getByRole('button', { name: 'Thêm dịch vụ' })

    expect(add).toBeDisabled()
    chooseService('svc-water', '0')
    expect(add).toBeDisabled()
    chooseService('svc-water', '100')
    expect(add).toBeDisabled()
    chooseService('svc-water', '1.5')
    expect(add).toBeDisabled()
    chooseService('svc-water', '2')
    expect(add).toBeEnabled()
    expect(post).not.toHaveBeenCalled()
  })

  it('retries with the same request id after a failure', async () => {
    mockGet(charges())
    const post = vi
      .spyOn(api, 'post')
      .mockRejectedValueOnce({
        isAxiosError: true,
        response: { status: 500, data: { message: 'Boom' } },
      })
      .mockResolvedValue({ data: {} })
    await openPanel()
    await departure().findByText('Chưa có phụ phí.')
    await waitFor(() =>
      expect(
        within(departure().getByLabelText(/Dịch vụ \/ sản phẩm/)).getAllByRole('option').length,
      ).toBeGreaterThan(1),
    )

    chooseService('svc-water', '2')
    fireEvent.click(departure().getByRole('button', { name: 'Thêm dịch vụ' }))
    expect(await departure().findByRole('alert')).toBeInTheDocument()
    fireEvent.click(departure().getByRole('button', { name: 'Thêm dịch vụ' }))
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2))

    const ids = post.mock.calls.map((call) => (call[1] as { requestId: string }).requestId)
    expect(ids[1]).toBe(ids[0])
  })
})

describe('Classifying additional charges and late check-out', () => {
  it('sends the chosen category with the charge, and omits it when none is chosen', async () => {
    mockGet(charges())
    const post = vi.spyOn(api, 'post').mockResolvedValue({ data: {} })
    await openPanel()
    await departure().findByText('Chưa có phụ phí.')

    fill('30000', 'Vỡ ly')
    fireEvent.change(departure().getByLabelText('Loại phụ phí'), { target: { value: 'DAMAGE' } })
    fireEvent.click(departure().getByRole('button', { name: 'Thêm phụ phí' }))
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/bookings/d1/charges', {
        amount: 30000,
        reason: 'Vỡ ly',
        category: 'DAMAGE',
        requestId: expect.any(String),
      }),
    )
    await waitFor(() => expect(departure().getByLabelText('Loại phụ phí')).toHaveValue(''))
  })

  it('labels the category next to a recorded charge', async () => {
    mockGet(
      charges([
        { reason: 'Vỡ ly', amount: 30_000, category: 'DAMAGE' },
        { reason: 'Ở thêm 2 giờ', amount: 100_000, category: 'LATE_CHECKOUT' },
      ]),
    )
    await openPanel()

    const recorded = within(await departure().findByRole('list', { name: 'Phụ phí đã ghi' }))
    expect(recorded.getByText('Hư hỏng')).toBeInTheDocument()
    expect(recorded.getByText('Trả phòng muộn')).toBeInTheDocument()
  })

  it('reminds the receptionist to check for a late check-out once the planned time has passed', async () => {
    const late = list()
    late.departures[0] = { ...late.departures[0], checkOut: '2020-01-01T05:00:00.000Z' }
    vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
      if (url === '/front-desk/same-day') return { data: late }
      if (url === '/bookings/d1/charges') return { data: charges() }
      if (url === '/bookings/service-catalog') return { data: { items: catalog } }
      throw new Error(`unexpected GET ${url}`)
    })
    await openPanel()

    expect(await departure().findByText(/quá giờ trả phòng/i)).toBeInTheDocument()
  })

  it('does not remind before the planned check-out time', async () => {
    mockGet(charges())
    await openPanel()
    await departure().findByText('Chưa có phụ phí.')

    expect(departure().queryByText(/quá giờ trả phòng/i)).not.toBeInTheDocument()
  })
})

describe('Room inspection inside the check-out dialog', () => {
  it('offers the inspection request above the charges for a checked-in guest', async () => {
    mockGet(charges())
    await openPanel()

    expect(await departure().findByRole('heading', { name: 'Kiểm tra phòng' })).toBeInTheDocument()
    expect(
      await departure().findByRole('button', { name: 'Yêu cầu kiểm tra phòng' }),
    ).toBeInTheDocument()
  })
})
