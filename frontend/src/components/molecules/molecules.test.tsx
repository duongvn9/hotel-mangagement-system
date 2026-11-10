import { parseISO } from 'date-fns'
import { fireEvent, render, screen } from '@testing-library/react'
import { Inbox } from 'lucide-react'
import * as molecules from '.'
import { normalizeRange } from './date-range'
import { DateField } from './DateField'
import { DateRangeField } from './DateRangeField'
import { EmptyState } from './EmptyState'
import { FormField } from './FormField'
import { KeyValue } from './KeyValue'
import { Stars } from './Stars'
import { StatCard } from './StatCard'
import { Input } from '../atoms'

describe('FormField', () => {
  it('links the label to the control and shows the error as an alert', () => {
    render(
      <FormField label="Họ tên" htmlFor="name" error="Vui lòng nhập họ tên" required>
        <Input id="name" aria-describedby="name-error" />
      </FormField>,
    )
    expect(screen.getByLabelText(/Họ tên/)).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Vui lòng nhập họ tên')
    expect(screen.getByLabelText(/Họ tên/)).toHaveAccessibleDescription('Vui lòng nhập họ tên')
    expect(screen.getByText('*')).toHaveAttribute('aria-hidden', 'true')
  })

  it('shows the hint and no alert when there is no error', () => {
    render(
      <FormField label="Email" htmlFor="email" hint="Dùng email đã đặt phòng">
        <Input id="email" />
      </FormField>,
    )
    expect(screen.getByText('Dùng email đã đặt phòng')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('StatCard / EmptyState / KeyValue', () => {
  it('shows the stat label, value, trend and hint', () => {
    render(
      <StatCard
        label="Doanh thu"
        value="12.000.000 ₫"
        trend="+8%"
        hint="so với tuần trước"
        icon={Inbox}
      />,
    )
    expect(screen.getByText('Doanh thu')).toBeInTheDocument()
    expect(screen.getByText('12.000.000 ₫')).toBeInTheDocument()
    expect(screen.getByText('+8%')).toBeInTheDocument()
    expect(screen.getByText(/so với tuần trước/)).toBeInTheDocument()
  })

  it('renders an empty state with a title, body and action', () => {
    render(
      <EmptyState
        title="Chưa có đặt phòng"
        body="Hãy tạo đặt phòng đầu tiên."
        action={<button>Tạo mới</button>}
      />,
    )
    expect(screen.getByRole('heading', { name: 'Chưa có đặt phòng' })).toBeInTheDocument()
    expect(screen.getByText('Hãy tạo đặt phòng đầu tiên.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tạo mới' })).toBeInTheDocument()
  })

  it('shows a key and its value', () => {
    render(<KeyValue k="Phòng" v="Suite 501" />)
    expect(screen.getByText('Phòng')).toBeInTheDocument()
    expect(screen.getByText('Suite 501')).toBeInTheDocument()
  })
})

describe('Stars', () => {
  it('fills the first N stars', () => {
    render(<Stars value={3} />)
    expect(document.querySelectorAll('svg.fill-primary')).toHaveLength(3)
  })

  it('is read-only without onChange and calls onChange(5) when the fifth star is pressed', () => {
    const { rerender } = render(<Stars value={2} />)
    expect(screen.getAllByRole('button')[0]).toBeDisabled()
    const onChange = vi.fn()
    rerender(<Stars value={2} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: '5 stars' }))
    expect(onChange).toHaveBeenCalledWith(5)
  })

  it('renders a labelled read-only image with no buttons when given a label', () => {
    render(<Stars value={2} label="2 trên 5 sao" />)
    expect(screen.getByRole('img', { name: '2 trên 5 sao' })).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
    expect(document.querySelectorAll('svg.fill-primary')).toHaveLength(2)
  })
})

describe('DateField', () => {
  it('shows the selected date and a placeholder when empty', () => {
    const { rerender } = render(<DateField value="2026-11-10" onChange={() => {}} />)
    expect(screen.getByRole('button')).toHaveTextContent('10/11/2026')
    rerender(<DateField value="" onChange={() => {}} />)
    expect(screen.getByRole('button')).toHaveTextContent('Chọn ngày')
  })
})

describe('DateRangeField', () => {
  it('shows the selected range as dd/MM', () => {
    render(<DateRangeField from="2026-11-10" to="2026-11-12" onChange={() => {}} />)
    expect(screen.getByRole('button')).toHaveTextContent('10/11')
    expect(screen.getByRole('button')).toHaveTextContent('12/11')
  })

  it('does not throw when to is not after from', () => {
    expect(() =>
      render(<DateRangeField from="2026-11-10" to="2026-11-10" onChange={() => {}} />),
    ).not.toThrow()
  })

  it('does not throw for an empty or invalid date and shows a placeholder', () => {
    render(<DateRangeField from="" to="not-a-date" onChange={() => {}} />)
    expect(screen.getByRole('button')).toHaveTextContent('Chọn ngày')
  })

  it('pushes the end date to the day after the start when it is missing or not later', () => {
    expect(normalizeRange(parseISO('2026-11-10'))).toEqual(['2026-11-10', '2026-11-11'])
    expect(normalizeRange(parseISO('2026-11-10'), parseISO('2026-11-10'))).toEqual([
      '2026-11-10',
      '2026-11-11',
    ])
    expect(normalizeRange(parseISO('2026-11-10'), parseISO('2026-11-08'))).toEqual([
      '2026-11-10',
      '2026-11-11',
    ])
    expect(normalizeRange(parseISO('2026-11-10'), parseISO('2026-11-14'))).toEqual([
      '2026-11-10',
      '2026-11-14',
    ])
  })
})

import { PhotoTile } from './PhotoTile'
import { SectionHeading } from './SectionHeading'

describe('SectionHeading', () => {
  it('renders eyebrow, title and body using the requested heading tag', () => {
    const { rerender } = render(
      <SectionHeading
        eyebrow="Khách sạn"
        title="Hai mươi bốn phòng"
        body="Nghỉ dưỡng tĩnh lặng."
        as="h1"
      />,
    )
    expect(screen.getByText('Khách sạn')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 1, name: 'Hai mươi bốn phòng' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Nghỉ dưỡng tĩnh lặng.')).toBeInTheDocument()

    rerender(<SectionHeading title="Phòng & suite" as="h2" align="center" />)
    expect(screen.getByRole('heading', { level: 2, name: 'Phòng & suite' })).toBeInTheDocument()
  })
})

describe('PhotoTile', () => {
  it('renders an image with alt, lazy loading and optional caption', () => {
    render(
      <PhotoTile
        src="/assets/lobby.jpg"
        alt="Sảnh khách sạn"
        caption="Khu vực đón tiếp"
        aspect="4/3"
      />,
    )
    const img = screen.getByRole('img', { name: 'Sảnh khách sạn' })
    expect(img).toHaveAttribute('src', '/assets/lobby.jpg')
    expect(img).toHaveAttribute('loading', 'lazy')
    expect(screen.getByText('Khu vực đón tiếp')).toBeInTheDocument()
  })
})

describe('Alert', () => {
  it('renders role="alert" and text for danger tone', () => {
    render(<molecules.Alert tone="danger">Có lỗi xảy ra</molecules.Alert>)
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Có lỗi xảy ra')
    expect(alert).toHaveClass('text-destructive')
  })

  it('renders role="status" and text for success tone', () => {
    render(<molecules.Alert tone="success">Thao tác thành công</molecules.Alert>)
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('Thao tác thành công')
    expect(status).toHaveClass('text-success')
  })

  it.each([
    ['warning', 'text-warning'],
    ['info', 'text-info'],
  ] as const)('applies token classes for tone %s', (tone, toneClass) => {
    render(<molecules.Alert tone={tone}>Thông báo {tone}</molecules.Alert>)
    const status = screen.getByRole('status')
    expect(status).toHaveClass(toneClass)
  })

  it('renders with title when provided', () => {
    render(
      <molecules.Alert tone="info" title="Lưu ý">
        Nội dung thông báo
      </molecules.Alert>,
    )
    expect(screen.getByText('Lưu ý')).toBeInTheDocument()
    expect(screen.getByText('Nội dung thông báo')).toBeInTheDocument()
  })
})

describe('molecules barrel', () => {
  it('re-exports the composite primitives and own components', () => {
    for (const name of [
      'Select',
      'Tabs',
      'Popover',
      'Tooltip',
      'DropdownMenu',
      'Toaster',
      'FormField',
      'StatCard',
      'EmptyState',
      'KeyValue',
      'Stars',
      'DateRangeField',
      'SectionHeading',
      'PhotoTile',
      'Alert',
    ]) {
      expect(molecules).toHaveProperty(name)
    }
  })
})
