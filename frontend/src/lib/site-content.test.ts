import { guestImages } from '@/assets/guest'
import { siteContent } from './site-content'

describe('siteContent', () => {
  it('exports valid non-empty placeholder content', () => {
    expect(typeof siteContent.tagline).toBe('string')
    expect(siteContent.tagline.trim().length).toBeGreaterThan(0)
    expect(typeof siteContent.address).toBe('string')
    expect(siteContent.address.trim().length).toBeGreaterThan(0)
    expect(typeof siteContent.phone).toBe('string')
    expect(siteContent.phone.trim().length).toBeGreaterThan(0)
    expect(typeof siteContent.email).toBe('string')
    expect(siteContent.email.trim().length).toBeGreaterThan(0)
    expect(typeof siteContent.roomCount).toBe('number')
    expect(siteContent.roomCount).toBeGreaterThan(0)
    expect(typeof siteContent.intro).toBe('string')
    expect(siteContent.intro.trim().length).toBeGreaterThan(0)
  })
})

describe('guestImages', () => {
  const expectedKeys = [
    'hero',
    'lobby',
    'standard',
    'deluxe',
    'family',
    'suite',
    'dining',
    'spa',
    'bay',
  ] as const

  it('contains exactly the 9 expected image keys with non-empty string values', () => {
    expect(Object.keys(guestImages).sort()).toEqual([...expectedKeys].sort())
    for (const key of expectedKeys) {
      expect(typeof guestImages[key]).toBe('string')
      expect(guestImages[key].length).toBeGreaterThan(0)
    }
  })
})
