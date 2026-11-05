import { fdate, fshort, label, vnd } from './format'

describe('format helpers', () => {
  it('formats VND with dot grouping and the dong sign', () => {
    expect(vnd(1500000)).toContain('1.500.000')
    expect(vnd(1500000).endsWith(' ₫')).toBe(true)
  })

  it('formats dates in Vietnamese', () => {
    expect(fdate('2026-11-06')).toBe('06 thg 11, 2026')
    expect(fshort('2026-11-06')).toBe('06/11')
  })

  it('translates known enum labels', () => {
    expect(label('CHECKED_IN')).toBe('Đã nhận phòng')
  })

  it('prettifies unknown enum values instead of throwing', () => {
    expect(label('SOMETHING_ELSE')).toBe('Something else')
    expect(label('')).toBe('')
  })
})
