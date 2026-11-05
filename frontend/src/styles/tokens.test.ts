import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const tokensPath = resolve(import.meta.dirname, '../../../design-system/tokens.css')
const prototypePath = resolve(import.meta.dirname, '../../../ui-prototype/src/styles.css')

/** Lấy mọi `--biến: giá trị;` trong khối `:root { … }` đầu tiên của file CSS. */
function rootVariables(css: string): Record<string, string> {
  const start = css.indexOf(':root')
  const open = css.indexOf('{', start)
  const close = css.indexOf('}', open)
  const body = css.slice(open + 1, close)
  const variables: Record<string, string> = {}
  for (const [, name, value] of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    variables[name] = value.replace(/\s+/g, ' ').trim()
  }
  return variables
}

describe('design tokens', () => {
  it('defines the core semantic variables', () => {
    const tokens = rootVariables(readFileSync(tokensPath, 'utf8'))
    for (const name of ['--primary', '--ink', '--surface', '--radius', '--background']) {
      expect(tokens).toHaveProperty(name)
    }
  })

  // Prototype nằm ngoài Docker context nên chỉ so khi có mặt (CI và máy dev có đủ repo).
  it.skipIf(!existsSync(prototypePath))('matches the prototype :root block exactly', () => {
    const tokens = rootVariables(readFileSync(tokensPath, 'utf8'))
    const prototype = rootVariables(readFileSync(prototypePath, 'utf8'))
    expect(Object.keys(prototype).length).toBeGreaterThan(20)
    expect(tokens).toEqual(prototype)
  })
})
