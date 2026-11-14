import { describe, expect, it } from 'vitest'
import { mapGuestServerErrors, validateGuestContact } from './guest-validation'

describe('validateGuestContact', () => {
  const valid = {
    guestName: 'Nguyễn Văn A',
    guestEmail: 'a@example.com',
    guestPhone: '0900000000',
  }

  it('accepts valid contact info', () => {
    expect(validateGuestContact(valid)).toEqual({})
  })

  it('requires each field', () => {
    expect(validateGuestContact({ guestName: ' ', guestEmail: '', guestPhone: '' })).toEqual({
      guestName: 'Vui lòng nhập họ tên.',
      guestEmail: 'Vui lòng nhập email.',
      guestPhone: 'Vui lòng nhập số điện thoại.',
    })
  })

  it('rejects a malformed email', () => {
    expect(validateGuestContact({ ...valid, guestEmail: 'not-an-email' }).guestEmail).toBe(
      'Email không hợp lệ.',
    )
  })

  it('rejects a phone with letters or wrong length', () => {
    expect(validateGuestContact({ ...valid, guestPhone: 'abc' }).guestPhone).toContain(
      'Số điện thoại không hợp lệ',
    )
    expect(validateGuestContact({ ...valid, guestPhone: '12345' }).guestPhone).toContain(
      'Số điện thoại không hợp lệ',
    )
  })

  it('rejects an over-long name', () => {
    expect(validateGuestContact({ ...valid, guestName: 'a'.repeat(121) }).guestName).toContain(
      'Họ tên không hợp lệ',
    )
  })
})

describe('mapGuestServerErrors', () => {
  it('routes server validation messages to the matching field in Vietnamese', () => {
    const { fieldErrors, rest } = mapGuestServerErrors([
      'guestPhone is invalid',
      'guestEmail must be an email',
      'guestName must be shorter than or equal to 120 characters',
    ])
    expect(fieldErrors.guestPhone).toContain('Số điện thoại không hợp lệ')
    expect(fieldErrors.guestEmail).toBe('Email không hợp lệ.')
    expect(fieldErrors.guestName).toContain('Họ tên không hợp lệ')
    expect(rest).toEqual([])
  })

  it('keeps unrecognized messages for the general banner', () => {
    const { fieldErrors, rest } = mapGuestServerErrors(['Mã giữ phòng không hợp lệ'])
    expect(fieldErrors).toEqual({})
    expect(rest).toEqual(['Mã giữ phòng không hợp lệ'])
  })
})
