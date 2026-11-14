/** Kiểm tra và dịch lỗi thông tin liên hệ của khách cho luồng đặt phòng online. */

export type GuestField = 'guestName' | 'guestEmail' | 'guestPhone'
export type GuestFieldErrors = Partial<Record<GuestField, string>>

/** Class bôi đỏ viền ô nhập đang có lỗi (dùng chung cho các form đặt phòng). */
export const INVALID_INPUT_CLASS = 'border-destructive focus-visible:ring-destructive'

export interface GuestContact {
  guestName: string
  guestEmail: string
  guestPhone: string
}

// Giống ràng buộc backend (SubmitBookingDetailsDto): email chuẩn, SĐT 6–20 ký tự số/khoảng trắng/+/-.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE = /^[0-9+\-\s]{6,20}$/

const PHONE_INVALID =
  'Số điện thoại không hợp lệ (6–20 ký tự, chỉ gồm số, khoảng trắng, dấu + hoặc -).'
const EMAIL_INVALID = 'Email không hợp lệ.'
const NAME_INVALID = 'Họ tên không hợp lệ (tối đa 120 ký tự).'

/** Kiểm tra phía client, trả lỗi tiếng Việt theo từng trường (chỉ gồm trường có lỗi). */
export function validateGuestContact(contact: GuestContact): GuestFieldErrors {
  const errors: GuestFieldErrors = {}
  const name = contact.guestName.trim()
  const email = contact.guestEmail.trim()
  const phone = contact.guestPhone.trim()
  if (!name) errors.guestName = 'Vui lòng nhập họ tên.'
  else if (name.length > 120) errors.guestName = NAME_INVALID
  if (!email) errors.guestEmail = 'Vui lòng nhập email.'
  else if (email.length > 160 || !EMAIL.test(email)) errors.guestEmail = EMAIL_INVALID
  if (!phone) errors.guestPhone = 'Vui lòng nhập số điện thoại.'
  else if (!PHONE.test(phone)) errors.guestPhone = PHONE_INVALID
  return errors
}

// Nhận diện trường từ message server: khớp cả tên trường tiếng Anh (vd "guestPhone is invalid")
// lẫn message tiếng Việt backend trả về (vd "Số điện thoại không hợp lệ", "Email tối đa 160 ký tự").
const PHONE_HINT = /guestphone|số điện thoại/i
const EMAIL_HINT = /guestemail|email/i
const NAME_HINT = /guestname|họ tên/i

/**
 * Phân loại message validate từ server về đúng trường (tiếng Việt); phần không nhận ra (vd mã giữ
 * phòng, ngày, số khách) giữ nguyên để hiển thị ở thông báo chung.
 */
export function mapGuestServerErrors(messages: string[]): {
  fieldErrors: GuestFieldErrors
  rest: string[]
} {
  const fieldErrors: GuestFieldErrors = {}
  const rest: string[] = []
  for (const raw of messages) {
    const message = raw.trim()
    if (!message) continue
    if (PHONE_HINT.test(message)) fieldErrors.guestPhone = PHONE_INVALID
    else if (EMAIL_HINT.test(message)) fieldErrors.guestEmail = EMAIL_INVALID
    else if (NAME_HINT.test(message)) fieldErrors.guestName = NAME_INVALID
    else rest.push(message)
  }
  return { fieldErrors, rest }
}
