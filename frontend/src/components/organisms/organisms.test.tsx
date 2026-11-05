import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import * as organisms from '.'
import { Donut, RevenueArea, SimpleBars } from './charts'
import { DataTable, type Column } from './DataTable'
import { PageHeader } from './PageHeader'
import { Panel } from './Panel'
import { SearchBar } from './SearchBar'
import { Unauthorized } from './Unauthorized'

interface Row {
  id: string
  name: string
  status: string
}

const columns: Column<Row>[] = [
  { key: 'name', header: 'Tên' },
  { key: 'status', header: 'Trạng thái' },
]

const make = (n: number): Row[] =>
  Array.from({ length: n }, (_, i) => ({ id: `r${i + 1}`, name: `Phòng ${i + 1}`, status: 'OPEN' }))

describe('PageHeader and Panel', () => {
  it('renders the header title, subtitle, eyebrow and actions', () => {
    render(
      <PageHeader
        eyebrow="Lễ tân"
        title="Đặt phòng"
        subtitle="Danh sách hôm nay"
        actions={<button>Thêm</button>}
      />,
    )
    expect(screen.getByRole('heading', { level: 1, name: 'Đặt phòng' })).toBeInTheDocument()
    expect(screen.getByText('Danh sách hôm nay')).toBeInTheDocument()
    expect(screen.getByText('Lễ tân')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Thêm' })).toBeInTheDocument()
  })

  it('renders a panel with title, action and content', () => {
    render(
      <Panel title="Doanh thu" action={<a href="/x">Xem tất cả</a>}>
        Nội dung
      </Panel>,
    )
    expect(screen.getByRole('heading', { name: 'Doanh thu' })).toBeInTheDocument()
    expect(screen.getByText('Nội dung')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Xem tất cả' })).toBeInTheDocument()
  })
})

describe('DataTable', () => {
  it('renders headers and every cell', () => {
    render(<DataTable rows={make(3)} columns={columns} />)
    expect(screen.getByRole('columnheader', { name: 'Tên' })).toBeInTheDocument()
    expect(screen.getByText('Phòng 1')).toBeInTheDocument()
    expect(screen.getByText('Phòng 3')).toBeInTheDocument()
    expect(screen.getByText('3 kết quả')).toBeInTheDocument()
  })

  it('shows an empty state instead of rows when there is no data', () => {
    render(<DataTable rows={[]} columns={columns} />)
    expect(screen.getByText('Không có kết quả phù hợp')).toBeInTheDocument()
    expect(screen.queryByText('Phòng 1')).not.toBeInTheDocument()
  })

  it('uses the custom empty node when provided', () => {
    render(<DataTable rows={[]} columns={columns} empty={<p>Chưa có phòng</p>} />)
    expect(screen.getByText('Chưa có phòng')).toBeInTheDocument()
  })

  it('shows skeleton rows while loading and no empty state', () => {
    const { container } = render(<DataTable rows={[]} columns={columns} loading />)
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
    expect(screen.queryByText('Không có kết quả phù hợp')).not.toBeInTheDocument()
  })

  it('paginates and moves between pages', () => {
    render(<DataTable rows={make(5)} columns={columns} pageSize={2} />)
    expect(screen.getByText('Trang 1 / 3')).toBeInTheDocument()
    expect(screen.queryByText('Phòng 3')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }))
    expect(screen.getByText('Trang 2 / 3')).toBeInTheDocument()
    expect(screen.getByText('Phòng 3')).toBeInTheDocument()
  })

  it('goes back to page 1 when the search text changes while on a later page', () => {
    render(<DataTable rows={make(5)} columns={columns} pageSize={2} search={(r) => r.name} />)
    fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }))
    fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }))
    expect(screen.getByText('Trang 3 / 3')).toBeInTheDocument()
    fireEvent.change(screen.getByPlaceholderText('Tìm kiếm…'), { target: { value: 'Phòng 4' } })
    expect(screen.getByText('Trang 1 / 1')).toBeInTheDocument()
    expect(screen.getByText('Phòng 4')).toBeInTheDocument()
  })

  it('keeps a very long cell inside the horizontally scrollable wrapper', () => {
    const long = 'x'.repeat(300)
    render(<DataTable rows={[{ id: 'a', name: long, status: 'OPEN' }]} columns={columns} />)
    const cell = screen.getByText(long)
    expect(cell.closest('.overflow-x-auto')).not.toBeNull()
  })

  it('calls onRowClick with the clicked row', () => {
    const onRowClick = vi.fn()
    render(<DataTable rows={make(2)} columns={columns} onRowClick={onRowClick} />)
    fireEvent.click(within(screen.getByText('Phòng 2').closest('tr')!).getByText('Phòng 2'))
    expect(onRowClick).toHaveBeenCalledWith({ id: 'r2', name: 'Phòng 2', status: 'OPEN' })
  })
})

describe('SearchBar', () => {
  it('reports the chosen dates and guests when searching', () => {
    const onSearch = vi.fn()
    render(
      <SearchBar
        initial={{ from: '2026-11-10', to: '2026-11-12', guests: 2 }}
        onSearch={onSearch}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Kiểm tra phòng trống/ }))
    expect(onSearch).toHaveBeenCalledWith({ from: '2026-11-10', to: '2026-11-12', guests: 2 })
  })

  it('defaults to a valid future range when no initial value is given', () => {
    const onSearch = vi.fn()
    render(<SearchBar onSearch={onSearch} />)
    fireEvent.click(screen.getByRole('button', { name: /Kiểm tra phòng trống/ }))
    const { from, to, guests } = onSearch.mock.calls[0][0]
    expect(from).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(to > from).toBe(true)
    expect(guests).toBe(2)
  })
})

describe('Unauthorized', () => {
  it('explains the restriction and links back to the given page', () => {
    render(
      <MemoryRouter initialEntries={['/manager/reports']}>
        <Unauthorized homeTo="/staff" />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
    expect(screen.getByText('/manager/reports')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Về trang chủ/ })).toHaveAttribute('href', '/staff')
  })

  it('defaults the link to the site root', () => {
    render(
      <MemoryRouter>
        <Unauthorized />
      </MemoryRouter>,
    )
    expect(screen.getByRole('link', { name: /Về trang chủ/ })).toHaveAttribute('href', '/')
  })
})

describe('charts', () => {
  it('render without throwing when there is no data', () => {
    expect(() => render(<RevenueArea series={[]} />)).not.toThrow()
    expect(() => render(<SimpleBars data={[]} k="count" />)).not.toThrow()
    expect(() => render(<Donut data={[]} />)).not.toThrow()
  })

  it('lists the legend entries of a donut', () => {
    render(
      <Donut
        data={[
          { name: 'Online', value: 4 },
          { name: 'Tại quầy', value: 2 },
        ]}
      />,
    )
    expect(screen.getByText('Online')).toBeInTheDocument()
    expect(screen.getByText('Tại quầy')).toBeInTheDocument()
  })
})

import { HeroBanner } from './HeroBanner'
import { RoomCard } from './RoomCard'

describe('HeroBanner', () => {
  it('renders heading, image with alt and children', () => {
    render(
      <HeroBanner
        image="/assets/hero.jpg"
        imageAlt="Hồ bơi vô cực"
        title="Nghỉ dưỡng nơi vịnh biển."
        eyebrow="Nha Trang"
        tall
      >
        <div data-testid="search-slot">Thanh tìm kiếm</div>
      </HeroBanner>,
    )
    expect(
      screen.getByRole('heading', { level: 1, name: 'Nghỉ dưỡng nơi vịnh biển.' }),
    ).toBeInTheDocument()
    const img = screen.getByRole('img', { name: 'Hồ bơi vô cực' })
    expect(img).toHaveAttribute('src', '/assets/hero.jpg')
    expect(screen.getByText('Nha Trang')).toBeInTheDocument()
    expect(screen.getByTestId('search-slot')).toBeInTheDocument()
  })
})

describe('RoomCard', () => {
  it('renders name, formatted price, amenities with +N and handles selection', () => {
    const onToggle = vi.fn()
    const longName = 'Phòng '.repeat(40)
    const { rerender } = render(
      <RoomCard
        name={longName}
        price={1200000}
        amenities={['Wifi', 'Ban công', 'Bồn tắm', 'Minibar', 'Máy pha cà phê']}
        onToggle={onToggle}
        toggleLabel="Chọn phòng Suite"
        selected
      />,
    )
    expect(screen.getByText(/1\.200\.000/)).toBeInTheDocument()
    expect(screen.getByText('Wifi')).toBeInTheDocument()
    expect(screen.getByText('Minibar')).toBeInTheDocument()
    expect(screen.getByText('+1')).toBeInTheDocument()
    expect(screen.queryByText('Máy pha cà phê')).not.toBeInTheDocument()

    const checkbox = screen.getByRole('checkbox', { name: 'Chọn phòng Suite' })
    expect(checkbox).toBeChecked()
    fireEvent.click(checkbox)
    expect(onToggle).toHaveBeenCalledTimes(1)

    // Heading has line-clamp-2 / truncate
    const heading = screen.getByRole('heading', { level: 2 })
    expect(heading.className).toMatch(/line-clamp-2|truncate/)

    // Render without image
    rerender(<RoomCard name="Phòng Deluxe" price={1500000} />)
    expect(screen.getByRole('heading', { name: 'Phòng Deluxe' })).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })
})

describe('SearchBar', () => {
  it('renders a form with role search, handles ariaLabel and submits normalized dates', () => {
    const onSearch = vi.fn()
    const { rerender } = render(
      <SearchBar
        initial={{ from: '2026-11-10', to: '2026-11-10', guests: 2 }}
        onSearch={onSearch}
      />,
    )
    const form = screen.getByRole('search', { name: 'Tìm phòng trống' })
    expect(form).toBeInTheDocument()

    // Submit via form
    fireEvent.submit(form)
    expect(onSearch).toHaveBeenCalledTimes(1)
    expect(onSearch).toHaveBeenCalledWith({
      from: '2026-11-10',
      to: '2026-11-11',
      guests: 2,
    })

    // Custom ariaLabel
    rerender(<SearchBar ariaLabel="Tìm kiếm kỳ nghỉ" onSearch={onSearch} />)
    expect(screen.getByRole('search', { name: 'Tìm kiếm kỳ nghỉ' })).toBeInTheDocument()
  })
})

describe('organisms barrel', () => {
  it('re-exports overlays and own components', () => {
    for (const name of [
      'Dialog',
      'Sheet',
      'AlertDialog',
      'PageHeader',
      'Panel',
      'DataTable',
      'SearchBar',
      'Unauthorized',
      'RevenueArea',
      'HeroBanner',
      'RoomCard',
    ]) {
      expect(organisms).toHaveProperty(name)
    }
  })
})
