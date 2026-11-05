import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { Button, buttonVariants } from './button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './dialog'
import { Input } from './input'

describe('shadcn primitives (vendored from the prototype)', () => {
  it('renders a small outline button that is accessible and can be disabled', () => {
    render(
      <Button variant="outline" size="sm" disabled>
        Lưu
      </Button>,
    )
    const button = screen.getByRole('button', { name: 'Lưu' })
    expect(button).toBeDisabled()
    expect(button).toHaveClass('h-8', 'border-input')
  })

  it('renders as the child element with asChild', () => {
    render(
      <Button asChild>
        <a href="/rooms">Phòng</a>
      </Button>,
    )
    expect(screen.getByRole('link', { name: 'Phòng' })).toHaveAttribute('href', '/rooms')
  })

  it('exposes token-based destructive classes through buttonVariants', () => {
    expect(buttonVariants({ variant: 'destructive' })).toContain('bg-destructive')
  })

  it('opens a dialog with an accessible name', () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Xác nhận</DialogTitle>
          <DialogDescription>Bạn chắc chắn?</DialogDescription>
        </DialogContent>
      </Dialog>,
    )
    expect(screen.getByRole('dialog', { name: 'Xác nhận' })).toBeInTheDocument()
  })

  it('lets the user type into an Input', () => {
    function Controlled() {
      const [value, setValue] = useState('')
      return <Input aria-label="Tên" value={value} onChange={(e) => setValue(e.target.value)} />
    }
    render(<Controlled />)
    fireEvent.change(screen.getByLabelText('Tên'), { target: { value: 'Nguyễn Văn A' } })
    expect(screen.getByLabelText('Tên')).toHaveValue('Nguyễn Văn A')
  })
})
