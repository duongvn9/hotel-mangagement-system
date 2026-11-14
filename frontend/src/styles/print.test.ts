import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const css = readFileSync(resolve(import.meta.dirname, 'index.css'), 'utf8')
const printBlock = css.slice(css.indexOf('@media print'))

/**
 * jsdom cannot paginate, so these guard the print rules that keep the receipt from being clipped by
 * the dialog it is shown in (a fixed, centred, height-limited box). Checked by hand in Chrome's
 * print preview.
 */
describe('receipt print stylesheet', () => {
  it('removes everything except the receipt from the layout, not just hides it', () => {
    expect(printBlock).toMatch(
      /body\s*>\s*\*:not\(:has\(#printable-receipt\)\)\s*{[^}]*display:\s*none/,
    )
  })

  it('lets the dialog around the receipt flow and grow with its content', () => {
    const rule =
      printBlock.match(/\[role=['"]dialog['"]\]:has\(#printable-receipt\)\s*{([^}]*)}/)?.[1] ?? ''
    for (const declaration of [
      /position:\s*static/,
      /transform:\s*none/,
      /--tw-translate-x:\s*0/,
      /--tw-translate-y:\s*0/,
      /max-height:\s*none/,
      /overflow:\s*visible/,
    ]) {
      expect(rule).toMatch(declaration)
    }
  })

  it('keeps the dark total bar when the browser drops background colours', () => {
    expect(printBlock).toMatch(/print-color-adjust:\s*exact/)
  })
})
