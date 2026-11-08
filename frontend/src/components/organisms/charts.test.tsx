import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { RevenueArea } from './charts'

vi.mock('recharts', () => {
  const empty = () => null
  const svg = ({ children }: { children?: ReactNode }) => <svg>{children}</svg>
  return {
    ResponsiveContainer: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    AreaChart: svg,
    BarChart: svg,
    PieChart: svg,
    Area: ({ isAnimationActive }: { isAnimationActive?: boolean }) => (
      <path data-testid="area" data-animate={String(isAnimationActive)} />
    ),
    Bar: empty,
    CartesianGrid: empty,
    Cell: empty,
    Pie: empty,
    Tooltip: empty,
    XAxis: empty,
    YAxis: empty,
  }
})

it('preserves chart animation by default', () => {
  render(<RevenueArea series={[]} />)
  expect(screen.getByTestId('area')).toHaveAttribute('data-animate', 'true')
})
it('can render a static revenue curve for reliable snapshot updates', () => {
  render(<RevenueArea series={[{ d: '07/11', revenue: 100 }]} animate={false} />)
  expect(screen.getByTestId('area')).toHaveAttribute('data-animate', 'false')
})
