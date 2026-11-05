import { cn } from './utils'

describe('cn', () => {
  it('lets the later Tailwind utility win over a conflicting earlier one', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4')
  })

  it('drops falsy values and joins the rest', () => {
    expect(cn('a', false && 'b', undefined, 'c')).toBe('a c')
  })
})
