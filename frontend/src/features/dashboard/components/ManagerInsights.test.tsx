import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { ManagerInsights } from './ManagerInsights'
import type { DashboardInsights, ManagerDashboard } from '../api'

const rooms = {
  available: true as const,
  asOf: '2026-11-07T00:00:00Z',
  activeTotal: 10,
  byStatus: { AVAILABLE: 3, OCCUPIED: 5, CLEANING: 1, MAINTENANCE: 1 },
}
const insights = {
  revenue: {
    available: true as const,
    from: '2026-10-25',
    to: '2026-11-07',
    amount: 14000000,
    changePercent: 25,
    series: [],
  },
  feedback: { available: true as const, count: 2, average: 4.5 },
  bookings: {
    available: true as const,
    activeCount: 3,
    recent: [
      {
        id: 'b1',
        code: 'BK001',
        guestName: 'Nguyễn '.repeat(50),
        rooms: ['101', '102'],
        checkIn: '2026-11-07T00:00:00Z',
        checkOut: '2026-11-08T00:00:00Z',
        status: 'CONFIRMED',
      },
    ],
  },
}
function show(value: DashboardInsights = insights, roomValue: ManagerDashboard['rooms'] = rooms) {
  return render(
    <MemoryRouter>
      <ManagerInsights insights={value} rooms={roomValue} />
    </MemoryRouter>,
  )
}
it('renders the four prototype KPIs with actual values and a real booking link, including long names', () => {
  show()
  expect(screen.getByText('50%')).toBeInTheDocument()
  expect(screen.getByText('14.000.000 ₫')).toBeInTheDocument()
  expect(screen.getByText('+25.0%')).toBeInTheDocument()
  expect(screen.getByText('4.5')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /BK001/ })).toHaveAttribute(
    'href',
    '/reception/bookings/BK001',
  )
  expect(screen.getByText(insights.bookings.recent[0].guestName.trim())).toHaveClass('break-words')
})
it('shows empty data without invented reviews or a percentage with a zero denominator', () => {
  show(
    {
      ...insights,
      feedback: { available: true, count: 0, average: null },
      revenue: { ...insights.revenue, changePercent: null },
      bookings: { ...insights.bookings, recent: [] },
    },
    { ...rooms, activeTotal: 0 },
  )
  expect(screen.getByText('Chưa có đặt phòng')).toBeInTheDocument()
  expect(screen.getByText('0 đánh giá có chấm sao')).toBeInTheDocument()
  expect(screen.queryByText('50%')).not.toBeInTheDocument()
  expect(screen.queryByText('+25.0%')).not.toBeInTheDocument()
})
