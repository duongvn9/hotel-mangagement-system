import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import * as atoms from '.'
import { Logo } from './Logo'
import { NativeSelect } from './NativeSelect'
import { StatusBadge } from './StatusBadge'

describe('StatusBadge', () => {
  it.each([
    ['CHECKED_IN', 'Đã nhận phòng', 'text-info'],
    ['CANCELLED', 'Đã huỷ', 'text-danger'],
    ['PENDING_DEPOSIT', 'Chờ đặt cọc', 'text-warning'],
    ['CONFIRMED', 'Đã xác nhận', 'text-success'],
  ])('shows %s as "%s" with %s', (status, text, tone) => {
    render(<StatusBadge status={status} />)
    expect(screen.getByText(text)).toHaveClass(tone)
  })

  it('falls back to a neutral tone and a prettified label for an unknown status', () => {
    render(<StatusBadge status="WEIRD_STATE" />)
    expect(screen.getByText('Weird state')).toHaveClass('text-muted-foreground')
  })

  it('does not throw for an empty status', () => {
    expect(() => render(<StatusBadge status="" />)).not.toThrow()
  })
})

describe('Logo', () => {
  it('links to the home page by default and shows the brand name', () => {
    render(
      <MemoryRouter>
        <Logo />
      </MemoryRouter>,
    )
    const link = screen.getByRole('link', { name: /Emily Hotel/ })
    expect(link).toHaveAttribute('href', '/')
    expect(link).toHaveClass('text-foreground')
  })

  it('switches to the light variant and a custom target', () => {
    render(
      <MemoryRouter>
        <Logo light to="/staff" />
      </MemoryRouter>,
    )
    const link = screen.getByRole('link', { name: /Emily Hotel/ })
    expect(link).toHaveAttribute('href', '/staff')
    expect(link).toHaveClass('text-ink-foreground')
  })

  it('renders a custom brand name and uses its initial letter', () => {
    render(
      <MemoryRouter>
        <Logo name="Grand Emily Hotel" />
      </MemoryRouter>,
    )
    const link = screen.getByRole('link', { name: /Grand Emily Hotel/ })
    expect(link).toHaveTextContent('Grand Emily Hotel')
    expect(within(link).getByText('G')).toBeInTheDocument()
  })
})

describe('NativeSelect', () => {
  it('renders options and reflects the controlled value', () => {
    render(
      <NativeSelect aria-label="Vai trò" value="b" onChange={() => {}}>
        <option value="a">Alpha</option>
        <option value="b">Beta</option>
      </NativeSelect>,
    )
    const select = screen.getByRole('combobox', { name: 'Vai trò' })
    expect(select).toHaveValue('b')
    expect(screen.getByRole('option', { name: 'Alpha' })).toBeInTheDocument()
  })

  it('forwards change events', () => {
    const onChange = vi.fn()
    render(
      <NativeSelect aria-label="Vai trò" value="a" onChange={onChange}>
        <option value="a">Alpha</option>
        <option value="b">Beta</option>
      </NativeSelect>,
    )
    fireEvent.change(screen.getByRole('combobox', { name: 'Vai trò' }), {
      target: { value: 'b' },
    })
    expect(onChange).toHaveBeenCalled()
  })

  it('can be disabled', () => {
    render(
      <NativeSelect aria-label="Vai trò" disabled>
        <option value="a">Alpha</option>
      </NativeSelect>,
    )
    expect(screen.getByRole('combobox', { name: 'Vai trò' })).toBeDisabled()
  })

  it('associates with a <label htmlFor> and forwards the ref', () => {
    const ref = { current: null as HTMLSelectElement | null }
    render(
      <>
        <label htmlFor="role">Vai trò</label>
        <NativeSelect id="role" ref={ref}>
          <option value="a">Alpha</option>
        </NativeSelect>
      </>,
    )
    expect(screen.getByLabelText('Vai trò')).toBe(screen.getByRole('combobox'))
    expect(ref.current).toBe(screen.getByRole('combobox'))
  })

  it('keeps long option text selectable', () => {
    const long = 'Nhân viên lễ tân khách sạn '.repeat(10)
    render(
      <NativeSelect aria-label="Vai trò" defaultValue="long">
        <option value="short">Ngắn</option>
        <option value="long">{long}</option>
      </NativeSelect>,
    )
    expect(screen.getByRole('combobox', { name: 'Vai trò' })).toHaveValue('long')
  })
})

describe('atoms barrel', () => {
  it('re-exports the primitives pages are allowed to use', () => {
    for (const name of ['Button', 'Input', 'Textarea', 'Label', 'Checkbox', 'Switch', 'Avatar']) {
      expect(atoms).toHaveProperty(name)
    }
    expect(atoms.StatusBadge).toBe(StatusBadge)
    expect(atoms.NativeSelect).toBe(NativeSelect)
    expect(atoms.Logo).toBe(Logo)
  })
})
