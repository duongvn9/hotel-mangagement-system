import { api } from '@/lib/api-client'

/**
 * Client cho luồng đặt phòng của Guest/Customer (UC05, UC07/UC46, UC12, UC20, UC21).
 * Backend hiện chỉ có endpoint ghi/flow nên mọi dữ liệu đọc lại được giữ ở client
 * (xem ./storage.ts). Shape khớp backend/src/modules/{bookings,payments}.
 */

/** Một phòng còn trống trả từ UC05; không lộ booking/customer. */
export interface AvailableRoom {
  id: string
  roomTypeId: string
  capacity: number
  /** Tên loại phòng (UC05 công khai trả kèm để hiển thị). */
  roomTypeName?: string
  /** Đơn giá mỗi đêm của loại phòng (VND). */
  pricePerNight?: number
}

export interface SearchAvailabilityParams {
  /** YYYY-MM-DD, giờ Việt Nam. */
  checkIn: string
  checkOut: string
  guests: number
  roomTypeId?: string
}

/** UC05 — Tìm phòng trống theo ngày ở và số khách. */
export async function searchAvailability(
  params: SearchAvailabilityParams,
): Promise<AvailableRoom[]> {
  return (await api.get<AvailableRoom[]>('/availability', { params })).data
}

export interface CreateBookingInput {
  rooms: string[]
  checkIn: string
  checkOut: string
  adultCount: number
  childCount: number
  guestName: string
  guestEmail: string
  guestPhone: string
}

export const BOOKING_STATUS_DISPLAY: Record<
  string,
  { label: string; tone: 'success' | 'info' | 'warning' | 'danger' | 'neutral' }
> = {
  ROOM_HELD: { label: 'Đang giữ phòng', tone: 'info' },
  PENDING_DEPOSIT: { label: 'Chờ đặt cọc', tone: 'warning' },
  CONFIRMED: { label: 'Đã xác nhận', tone: 'success' },
  CHECKED_IN: { label: 'Đã nhận phòng', tone: 'info' },
  CHECKED_OUT: { label: 'Đã trả phòng', tone: 'neutral' },
  CANCELLED: { label: 'Đã huỷ', tone: 'danger' },
  EXPIRED: { label: 'Hết hạn giữ phòng', tone: 'danger' },
}

/** Booking vừa tạo (UC07/UC46). */
export interface Booking {
  id: string
  code: string
  status: string
  rooms: string[]
  checkIn: string
  checkOut: string
  /** Số người lớn. */
  adultCount: number
  /** Số trẻ em. */
  childCount: number
  /** Tiền phòng server tính (VND). */
  roomTotal: number
  /** Tiền cọc cần thanh toán (VND). */
  depositAmount: number
  /** Thời điểm giữ phòng hết hạn (ISO); vắng khi booking không còn giữ phòng. */
  holdExpiresAt?: string
}

/** UC07/UC46 — Tạo booking. Nếu đang đăng nhập Customer, booking tự gắn với tài khoản. */
export async function createBooking(input: CreateBookingInput): Promise<Booking> {
  return (await api.post<Booking>('/bookings', input)).data
}

/** Yêu cầu giữ phòng khi khách bấm "Đặt phòng" (chưa cần thông tin liên hệ). */
export interface HoldBookingInput {
  rooms: string[]
  checkIn: string
  checkOut: string
  adultCount: number
  childCount?: number
}

/** Phản hồi khi giữ phòng (ROOM_HELD) — nguồn chuẩn để hiện tạm tính và đếm ngược. */
export interface HeldBooking {
  bookingId: string
  holdToken: string
  status: string
  rooms: string[]
  checkIn: string
  checkOut: string
  adultCount: number
  childCount: number
  roomTotal: number
  depositAmount: number
  holdExpiresAt: string
}

/**
 * Giữ phòng ngay khi bắt đầu đặt: backend tạo Booking nháp ROOM_HELD + RoomHold,
 * khoá phòng 15 phút. Một phiên chỉ giữ một booking; bấm lại trả hold cũ (không gia hạn).
 */
export async function holdBooking(input: HoldBookingInput): Promise<HeldBooking> {
  return (await api.post<HeldBooking>('/bookings/hold', input)).data
}

/** Nhập thông tin liên hệ cho hold còn hạn: ROOM_HELD → PENDING_DEPOSIT (không gia hạn). */
export interface SubmitBookingDetailsInput {
  holdToken: string
  guestName: string
  guestEmail: string
  guestPhone: string
}

export async function submitBookingDetails(
  input: SubmitBookingDetailsInput,
): Promise<HeldBooking> {
  return (await api.post<HeldBooking>('/bookings/details', input)).data
}

/**
 * Đọc trạng thái authoritative của một booking từ backend (thay vì localStorage).
 * Guest cùng trình duyệt được nhận diện qua cookie phiên; từ thiết bị khác cần mã booking.
 */
export async function getBooking(id: string, params: { code?: string } = {}): Promise<Booking> {
  return (await api.get<Booking>(`/bookings/${id}`, { params })).data
}

/** Phản hồi tối thiểu khi huỷ (service trả booking đã CANCELLED). */
export interface CancelledBooking {
  status: string
}

/** UC12 — Huỷ booking; Guest cần truyền mã (vé), Customer/lễ tân dùng phiên đăng nhập. */
export async function cancelBooking(
  id: string,
  input: { code?: string } = {},
): Promise<CancelledBooking> {
  return (await api.post<CancelledBooking>(`/bookings/${id}/cancel`, input)).data
}

export interface InitiatePaymentInput {
  bookingId: string
  /** Mã booking (vé) cho Guest tự thanh toán khi chưa đăng nhập. */
  code?: string
  locale?: 'vn' | 'en'
  bankCode?: string
}

/** Thông tin để chuyển hướng sang cổng VNPay. */
export interface PaymentInitiation {
  transactionRef: string
  paymentUrl: string
  amount: number
}

/** UC20 — Khởi tạo thanh toán tiền cọc qua VNPay. */
export async function initiateDeposit(input: InitiatePaymentInput): Promise<PaymentInitiation> {
  return (await api.post<PaymentInitiation>('/payments/deposit', input)).data
}

/** UC21 — Khởi tạo thanh toán phần còn lại qua VNPay. */
export async function initiateFinal(input: InitiatePaymentInput): Promise<PaymentInitiation> {
  return (await api.post<PaymentInitiation>('/payments/final', input)).data
}

export type PaymentResultStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED'

/** Kết quả xác minh trang Return — chỉ để hiển thị, không phải bằng chứng thanh toán. */
export interface PaymentReturn {
  transactionRef: string
  status: PaymentResultStatus
  responseCode: string
}

export const PAYMENT_RESULT_DISPLAY: Record<
  PaymentResultStatus,
  { label: string; tone: 'success' | 'warning' | 'danger' }
> = {
  SUCCESS: { label: 'Thanh toán thành công', tone: 'success' },
  PENDING: { label: 'Đang chờ xác nhận', tone: 'warning' },
  FAILED: { label: 'Thanh toán thất bại', tone: 'danger' },
  CANCELLED: { label: 'Đã huỷ thanh toán', tone: 'danger' },
}

/**
 * Xác minh dữ liệu VNPay trả về trang Return. Truyền NGUYÊN query string (không gồm dấu `?`)
 * để giữ đúng thứ tự/encoding mà backend dùng kiểm tra chữ ký.
 */
export async function verifyVnpayReturn(rawQuery: string): Promise<PaymentReturn> {
  const suffix = rawQuery ? `?${rawQuery}` : ''
  return (await api.get<PaymentReturn>(`/payments/vnpay/return${suffix}`)).data
}
