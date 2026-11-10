import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import type { BookingSummary } from './api'
import { BookingDetailLayout } from './components/BookingDetailLayout'

const summary = (overrides: Partial<BookingSummary> = {}): BookingSummary => ({
  bookingId: 'b1',
  code: 'BK2401',
  status: 'CHECKED_IN',
  source: 'ONLINE',
  checkIn: '2026-11-02T17:00:00.000Z',
  checkOut: '2026-11-03T17:00:00.000Z',
  adultCount: 2,
  childCount: 1,
  createdAt: '2026-10-26T17:00:00.000Z',
  depositAmount: 375_000,
  guest: { name: 'Nguyễn Minh Anh', email: 'minh.anh@mail.com', phone: '0901234567' },
  rooms: [{ roomNumber: '101', roomTypeName: 'Phòng Đôi Hướng Vườn' }],
  invoice: {
    roomTotal: 1_250_000,
    serviceTotal: 430_000,
    additionalTotal: 0,
    discountTotal: 0,
    taxTotal: 0,
    totalAmount: 1_680_000,
    depositPaid: 375_000,
    finalPaid: 0,
    balanceDue: 1_305_000,
  },
  payments: [
    {
      id: 'p1',
      method: 'VNPAY',
      purpose: 'DEPOSIT',
      status: 'SUCCESS',
      amount: 375_000,
      date: '2026-10-26T17:00:00.000Z',
    },
  ],
  serviceOrders: [
    {
      id: 's1',
      serviceName: 'Bữa sáng tại phòng',
      quantity: 1,
      amount: 280_000,
      status: 'PENDING',
      requestedTime: '2026-11-03T00:00:00.000Z',
    },
    {
      id: 's2',
      serviceName: 'Giặt ủi',
      quantity: 1,
      amount: 150_000,
      status: 'DONE',
      requestedTime: '2026-11-03T01:00:00.000Z',
    },
  ],
  ...overrides,
})

function renderLayout(value: BookingSummary, props: { backTo?: string; backLabel?: string } = {}) {
  return render(
    <MemoryRouter>
      <BookingDetailLayout
        summary={value}
        backTo={props.backTo ?? '/my-bookings'}
        backLabel={props.backLabel ?? 'Đặt phòng'}
        actions={<button type="button">Hành động</button>}
        notices={<p role="status">Phòng đang được giữ</p>}
      />
    </MemoryRouter>,
  )
}

const panel = (name: string) =>
  screen.getByRole('heading', { name }).closest('section') as HTMLElement

describe('BookingDetailLayout', () => {
  it('shows the code with its status and source, and who is staying where', () => {
    renderLayout(summary())

    expect(screen.getByRole('heading', { level: 1, name: 'BK2401' })).toBeInTheDocument()
    expect(screen.getByText('Đã nhận phòng')).toBeInTheDocument()
    expect(screen.getByText('Trực tuyến')).toBeInTheDocument()
    expect(
      screen.getByText('Nguyễn Minh Anh · Phòng Đôi Hướng Vườn · Phòng 101'),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Đặt phòng/ })).toHaveAttribute('href', '/my-bookings')
    expect(screen.getByRole('button', { name: 'Hành động' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Phòng đang được giữ')
  })

  it('labels a desk booking as a walk-in', () => {
    renderLayout(summary({ source: 'FRONT_DESK' }))
    expect(screen.getByText('Khách vãng lai')).toBeInTheDocument()
  })

  it('lists the stay details', () => {
    renderLayout(summary())
    const stay = within(panel('Lưu trú'))

    expect(stay.getByText('Nhận phòng')).toBeInTheDocument()
    expect(stay.getByText('Số đêm')).toBeInTheDocument()
    expect(stay.getByText('2 người lớn · 1 trẻ em')).toBeInTheDocument()
    expect(stay.getByText('Phòng Đôi Hướng Vườn', { selector: 'span' })).toBeInTheDocument()
    expect(stay.getByText('101')).toBeInTheDocument()
    expect(stay.getByText('Ngày đặt')).toBeInTheDocument()
  })

  it('lists payments with purpose, method, amount and status', () => {
    renderLayout(summary())
    const payments = within(panel('Thanh toán'))

    expect(payments.getByText(/Đặt cọc · VNPay/)).toBeInTheDocument()
    expect(payments.getByText('375.000 ₫')).toBeInTheDocument()
    expect(payments.getByText('Thành công')).toBeInTheDocument()
  })

  it('lists service orders with their amount and status', () => {
    renderLayout(summary())
    const orders = within(panel('Yêu cầu dịch vụ'))

    expect(orders.getByText('Bữa sáng tại phòng × 1')).toBeInTheDocument()
    expect(orders.getByText('280.000 ₫')).toBeInTheDocument()
    expect(orders.getByText('Đang chờ')).toBeInTheDocument()
    expect(orders.getByText('Giặt ủi × 1')).toBeInTheDocument()
    expect(orders.getByText('Hoàn thành')).toBeInTheDocument()
  })

  it('says so when there are no payments or service orders', () => {
    renderLayout(summary({ payments: [], serviceOrders: [] }))

    expect(within(panel('Thanh toán')).getByText('Chưa có thanh toán nào.')).toBeInTheDocument()
    expect(
      within(panel('Yêu cầu dịch vụ')).getByText('Chưa có dịch vụ nào cho kỳ lưu trú này.'),
    ).toBeInTheDocument()
  })

  it('summarises the invoice with the deposit, what was paid and what is left', () => {
    renderLayout(summary())
    const invoice = within(panel('Hoá đơn'))

    expect(invoice.getByText('Tiền phòng · 1 đêm')).toBeInTheDocument()
    expect(invoice.getByText('1.250.000 ₫')).toBeInTheDocument()
    expect(invoice.getByText('430.000 ₫')).toBeInTheDocument()
    expect(invoice.getAllByText('375.000 ₫')).toHaveLength(2) // tiền cọc và đã thanh toán
    expect(invoice.getByText('1.305.000 ₫')).toBeInTheDocument()
    expect(invoice.queryByText('Phụ phí')).not.toBeInTheDocument()
  })

  it('shows additional charges only when there are some', () => {
    renderLayout(summary({ invoice: { ...summary().invoice, additionalTotal: 90_000 } }))
    expect(within(panel('Hoá đơn')).getByText('Phụ phí')).toBeInTheDocument()
    expect(within(panel('Hoá đơn')).getByText('90.000 ₫')).toBeInTheDocument()
  })

  it('shows the guest and survives long strings and missing contact details', () => {
    const long = 'Nguyễn Thị Minh Khai Phương Anh Thư '.repeat(5).trim()
    renderLayout(summary({ guest: { name: long } }))
    const guest = within(panel('Khách'))

    expect(guest.getByText(long)).toBeInTheDocument()
    expect(guest.getAllByText('—')).toHaveLength(2) // email và điện thoại
  })

  it('works with no rooms assigned', () => {
    renderLayout(summary({ rooms: [] }))
    expect(screen.getByText('Nguyễn Minh Anh', { selector: 'p' })).toBeInTheDocument()
    expect(within(panel('Lưu trú')).getByText('Phòng')).toBeInTheDocument()
  })
})
