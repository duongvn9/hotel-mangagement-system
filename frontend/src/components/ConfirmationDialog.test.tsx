import { useState } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ConfirmationDialog } from './ConfirmationDialog'

function Example() {
  const [trigger, setTrigger] = useState<HTMLElement | null>(null)
  const [busy, setBusy] = useState(false)
  const [revision, setRevision] = useState(0)
  return (
    <>
      <button disabled={Boolean(trigger)} onClick={(event) => setTrigger(event.currentTarget)}>
        Open
      </button>
      {trigger && (
        <ConfirmationDialog
          label="Confirmation"
          busy={busy}
          returnFocus={trigger}
          onCancel={() => setTrigger(null)}
        >
          <button disabled={busy} onClick={() => setRevision(revision + 1)}>
            Confirm {revision}
          </button>
          <button disabled>Disabled</button>
          <button hidden>Hidden</button>
          <button disabled={busy} onClick={() => setTrigger(null)}>
            Back
          </button>
          <button tabIndex={-1} onClick={() => setBusy(!busy)}>
            Toggle busy
          </button>
        </ConfirmationDialog>
      )}
    </>
  )
}

beforeEach(() => {
  for (const name of ['showModal', 'close'] as const)
    if (!HTMLDialogElement.prototype[name])
      Object.defineProperty(HTMLDialogElement.prototype, name, { configurable: true, value() {} })
  vi.spyOn(HTMLDialogElement.prototype, 'showModal').mockImplementation(function (
    this: HTMLDialogElement,
  ) {
    this.setAttribute('open', '')
    this.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus()
  })
  vi.spyOn(HTMLDialogElement.prototype, 'close').mockImplementation(function (
    this: HTMLDialogElement,
  ) {
    this.removeAttribute('open')
    document.body.focus()
    this.dispatchEvent(new Event('close'))
  })
})
afterEach(() => vi.restoreAllMocks())

it('explicitly cycles Tab and Shift+Tab over enabled visible focusables without leaving the dialog', () => {
  render(<Example />)
  fireEvent.click(screen.getByText('Open'))
  const dialog = screen.getByRole('dialog')
  const confirm = screen.getByText('Confirm 0')
  const back = screen.getByText('Back')
  expect(confirm).toHaveFocus()
  for (let index = 0; index < 6; index++) {
    const forward = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    fireEvent(document.activeElement!, forward)
    expect(forward.defaultPrevented).toBe(true)
    expect(index % 2 === 0 ? back : confirm).toHaveFocus()
  }
  fireEvent.keyDown(confirm, { key: 'Tab', shiftKey: true })
  expect(back).toHaveFocus()
  fireEvent.keyDown(back, { key: 'Tab', shiftKey: true })
  expect(confirm).toHaveFocus()
  dialog.focus()
  fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true })
  expect(back).toHaveFocus()
})

it.each(['cancel', 'close', 'back'])(
  'restores the preserved trigger after %s even across callback rerenders and disabled opener',
  async (action) => {
    render(<Example />)
    const opener = screen.getByText('Open')
    opener.focus()
    fireEvent.click(opener)
    expect(opener).toBeDisabled()
    fireEvent.click(screen.getByText('Confirm 0'))
    expect(screen.getByText('Confirm 1')).toBeInTheDocument()
    expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalledOnce()
    const dialog = screen.getByRole('dialog') as HTMLDialogElement
    if (action === 'cancel') {
      const cancel = new Event('cancel', { cancelable: true })
      fireEvent(dialog, cancel)
      expect(cancel.defaultPrevented).toBe(true)
    } else if (action === 'close') {
      dialog.close()
    } else {
      fireEvent.click(screen.getByText('Back'))
    }
    await waitFor(() => expect(opener).toHaveFocus())
    expect(opener).toBeEnabled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    fireEvent.click(opener)
    expect(screen.getByText('Confirm 1')).toHaveFocus()
  },
)

it('prevents Escape cancellation while busy and keeps Tab on the dialog when no controls are enabled', () => {
  render(<Example />)
  fireEvent.click(screen.getByText('Open'))
  fireEvent.click(screen.getByText('Toggle busy'))
  const dialog = screen.getByRole('dialog')
  const cancel = new Event('cancel', { cancelable: true })
  fireEvent(dialog, cancel)
  expect(cancel.defaultPrevented).toBe(true)
  expect(dialog).toHaveAttribute('open')
  fireEvent.keyDown(dialog, { key: 'Tab' })
  expect(dialog).toHaveFocus()
  fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true })
  expect(dialog).toHaveFocus()
})
