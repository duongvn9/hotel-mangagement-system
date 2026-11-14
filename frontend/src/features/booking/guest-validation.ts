/** Kiểm tra và dịch lỗi thông tin liên hệ của khách cho luồng đặt phòng online. */

export type GuestField = 'guestName' | 'guestEmail' | 'guestPhone'
export type GuestFieldErrors = Partial<Record<GuestField, string>>

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

/**
 * Phân loại message validate từ server về đúng trường (tiếng Việt). Message backend bắt đầu bằng
 * tên trường (vd "guestPhone is invalid", "guestEmail must be an email"); phần không nhận ra giữ
 * nguyên để hiển thị ở thông báo chung.
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
    if (/guestphone/i.test(message)) fieldErrors.guestPhone = PHONE_INVALID
    else if (/guestemail/i.test(message)) fieldErrors.guestEmail = EMAIL_INVALID
    else if (/guestname/i.test(message)) fieldErrors.guestName = NAME_INVALID
    else rest.push(message)
  }
  return { fieldErrors, rest }
}
