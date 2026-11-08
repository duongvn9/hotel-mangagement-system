import { fireEvent, render, screen } from '@testing-library/react'
import { ConfirmationDialog } from './ConfirmationDialog'

beforeEach(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.setAttribute('open', '')
    },
  })
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.removeAttribute('open')
    },
  })
})

it.each(['', 'Nội dung rất dài '.repeat(200)])(
  'renders a named native modal with empty or long content',
  (content) => {
    const cancel = vi.fn()
    render(
      <ConfirmationDialog
        label="Xác nhận công việc"
        busy={false}
        returnFocus={null}
        onCancel={cancel}
      >
        {content}
      </ConfirmationDialog>,
    )
    const dialog = screen.getByRole('dialog', { name: 'Xác nhận công việc' })
    expect(dialog.tagName).toBe('DIALOG')
    expect(dialog).toHaveClass('bg-card', 'text-foreground', 'overflow-y-auto')
    expect(dialog.textContent).toBe(content)
    fireEvent(dialog, new Event('cancel', { bubbles: false, cancelable: true }))
    expect(cancel).toHaveBeenCalledOnce()
  },
)

it('prevents cancellation while busy', () => {
  const cancel = vi.fn()
  render(
    <ConfirmationDialog label="Đang xác nhận" busy returnFocus={null} onCancel={cancel}>
      Đang gửi
    </ConfirmationDialog>,
  )
  fireEvent(
    screen.getByRole('dialog', { name: 'Đang xác nhận' }),
    new Event('cancel', { bubbles: false, cancelable: true }),
  )
  expect(cancel).not.toHaveBeenCalled()
})
