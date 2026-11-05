import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import * as atoms from '.'
import { Logo } from './Logo'
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
})

describe('atoms barrel', () => {
  it('re-exports the primitives pages are allowed to use', () => {
    for (const name of ['Button', 'Input', 'Textarea', 'Label', 'Checkbox', 'Switch', 'Avatar']) {
      expect(atoms).toHaveProperty(name)
    }
    expect(atoms.StatusBadge).toBe(StatusBadge)
    expect(atoms.Logo).toBe(Logo)
  })
})
