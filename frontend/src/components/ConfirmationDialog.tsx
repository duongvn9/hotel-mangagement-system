import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'

export function ConfirmationDialog({
  label,
  busy,
  returnFocus,
  onCancel,
  children,
}: {
  label: string
  busy: boolean
  returnFocus: HTMLElement | null
  onCancel: () => void
  children: ReactNode
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [trigger] = useState(returnFocus)
  useLayoutEffect(() => {
    const element = dialog.current!
    element.showModal()
    return () => {
      element.close()
      requestAnimationFrame(() => {
        if (!element.isConnected && trigger?.isConnected) trigger.focus()
      })
    }
  }, [trigger])
  return (
    <dialog
      ref={dialog}
      tabIndex={-1}
      aria-label={label}
      className="m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-xl space-y-3 overflow-y-auto rounded-lg border border-stone-300 bg-white p-6 font-body text-pearl-900 backdrop:bg-pearl-900/50"
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return
        const element = event.currentTarget
        const focusable = Array.from(
          element.querySelectorAll<HTMLElement>(
            'a[href], button, input, select, textarea, [tabindex]',
          ),
        ).filter(
          (candidate) =>
            candidate.tabIndex >= 0 &&
            !candidate.matches(':disabled, [hidden], [aria-disabled="true"]') &&
            !candidate.closest('[hidden], [inert]') &&
            getComputedStyle(candidate).display !== 'none' &&
            getComputedStyle(candidate).visibility !== 'hidden',
        )
        event.preventDefault()
        const index = focusable.indexOf(document.activeElement as HTMLElement)
        const next = event.shiftKey
          ? index <= 0
            ? focusable.length - 1
            : index - 1
          : (index + 1) % focusable.length
        ;(focusable[next] ?? element).focus()
      }}
      onCancel={(event) => {
        event.preventDefault()
        if (!busy) onCancel()
      }}
      onClose={(event) => {
        if (!event.currentTarget.open) onCancel()
      }}
    >
      {children}
    </dialog>
  )
}
