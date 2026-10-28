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
export type BookingSource = 'ONLINE' | 'FRONT_DESK'

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
  source: BookingSource
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

export async function submitBookingDetails(input: SubmitBookingDetailsInput): Promise<HeldBooking> {
  return (await api.post<HeldBooking>('/bookings/details', input)).data
}

/**
 * Đọc trạng thái authoritative của một booking từ backend (thay vì localStorage).
 * Guest cùng trình duyệt được nhận diện qua cookie phiên; từ thiết bị khác cần mã booking.
 */
export async function getBooking(id: string, params: { code?: string } = {}): Promise<Booking> {
  return (await api.get<Booking>(`/bookings/${id}`, { params })).data
}

/** Booking walk-in lễ tân vừa tạo (UC08): vào thẳng CONFIRMED, không cọc/giữ phòng. */
export interface WalkInBooking {
  id: string
  code: string
  status: string
  rooms: string[]
  checkIn: string
  checkOut: string
  adultCount: number
  childCount: number
  source: BookingSource
  /** Tiền phòng server tính (VND). */
  roomTotal: number
}

/** UC08 — Lễ tân/Quản lý tạo booking cho khách vãng lai tại quầy. */
export type CreateWalkInBookingInput = CreateBookingInput

export async function createWalkInBooking(input: CreateWalkInBookingInput): Promise<WalkInBooking> {
  return (await api.post<WalkInBooking>('/bookings/walk-in', input)).data
}

export interface BookingListParams {
  page: number
  limit: number
  status?: string
  /** Tìm theo mã booking, tên, email hoặc số điện thoại khách. */
  q?: string
  /** YYYY-MM-DD, giờ Việt Nam, gồm cả hai đầu. */
  checkInFrom?: string
  checkInTo?: string
}

export interface BookingListRoom {
  id: string
  roomNumber?: string
  roomTypeName?: string
}

export interface BookingListItem {
  id: string
  code: string
  status: string
  guestName?: string
  guestEmail?: string
  guestPhone?: string
  rooms: BookingListRoom[]
  checkIn: string
  checkOut: string
  adultCount: number
  childCount: number
  source: BookingSource
  roomTotal: number
  createdAt: string
  /** Booking do nhân viên tạo tại quầy (UC08). */
  walkIn: boolean
}

export interface BookingListPage {
  items: BookingListItem[]
  total: number
  page: number
  limit: number
}

/** UC10 — Danh sách booking cho lễ tân/quản lý, lọc và phân trang phía server. */
export async function listBookings(params: BookingListParams): Promise<BookingListPage> {
  return (await api.get<BookingListPage>('/bookings', { params })).data
}

export interface InvoiceTotals {
  roomTotal: number
  serviceTotal: number
  additionalTotal: number
  discountTotal: number
  taxTotal: number
  totalAmount: number
  depositPaid: number
  finalPaid: number
  balanceDue: number
}

export interface BookingCharge {
  type: string
  amount: number
  reason: string
  sourceId?: string
}

export interface BookingCharges {
  bookingId: string
  code: string
  status: string
  /** Trạng thái hóa đơn: UNPAID, PARTIALLY_PAID hoặc PAID. */
  invoiceStatus: string
  totals: InvoiceTotals
  charges: BookingCharge[]
}

export interface AddChargeInput {
  /** Số tiền (VND, số nguyên dương). */
  amount: number
  reason: string
  /** Mã chống trùng cho một lần ghi; gửi lại cùng mã thì không ghi thêm khoản mới. */
  requestId: string
}

/** UC17 — Các khoản phí và tổng hợp hóa đơn của booking. */
export async function getBookingCharges(id: string): Promise<BookingCharges> {
  return (await api.get<BookingCharges>(`/bookings/${id}/charges`)).data
}

/** UC17 — Ghi phụ phí cho khách đang ở (booking CHECKED_IN). */
export async function addCheckoutCharge(
  id: string,
  input: AddChargeInput,
): Promise<BookingCharges> {
  return (await api.post<BookingCharges>(`/bookings/${id}/charges`, input)).data
}

/** UC18 — Lễ tân xác nhận đã thu tiền mặt thanh toán cuối; số tiền do server tính từ hóa đơn. */
export async function recordCashPayment(id: string, requestId: string): Promise<BookingCharges> {
  return (await api.post<BookingCharges>(`/bookings/${id}/payments/cash`, { requestId })).data
}

export interface CheckOutResult {
  id: string
  code: string
  status: string
  checkedOutAt: string
  rooms: { id: string; roomNumber: string; status: string }[]
  /** Hóa đơn cuối đã thanh toán đủ. */
  invoice: BookingCharges
}

/** UC18 — Trả phòng cho khách đã thanh toán đủ; phòng chuyển sang chờ dọn. */
export async function checkOutBooking(id: string): Promise<CheckOutResult> {
  return (await api.post<CheckOutResult>(`/bookings/${id}/check-out`)).data
}

export interface RoomReplacement {
  /** Phòng đang thuộc booking cần đổi đi. */
  from: string
  /** Phòng thay thế: cùng loại phòng, sẵn sàng và còn trống. */
  to: string
}

export interface CheckInResult {
  id: string
  code: string
  status: string
  checkedInAt: string
  rooms: { id: string; roomNumber: string }[]
}

/** UC16 — Nhận phòng; phòng chưa sẵn sàng có thể đổi sang phòng khác cùng loại (giá không đổi). */
export async function checkInBooking(
  id: string,
  replacements: RoomReplacement[] = [],
): Promise<CheckInResult> {
  const body = replacements.length > 0 ? { replacements } : {}
  return (await api.post<CheckInResult>(`/bookings/${id}/check-in`, body)).data
}

export interface CheckInRoomOption {
  id: string
  roomNumber: string
  roomTypeName: string
  /** Phòng đang hoạt động và có trạng thái vật lý AVAILABLE. */
  ready: boolean
  /** Trạng thái vật lý, hoặc INACTIVE nếu phòng bị vô hiệu hoá. */
  status: string
  /** Phòng thay thế hợp lệ; rỗng nếu phòng đã sẵn sàng. */
  replacements: { id: string; roomNumber: string; floor: number }[]
}

export interface CheckInOptions {
  bookingId: string
  code: string
  rooms: CheckInRoomOption[]
}

/** UC16 — Từng phòng của booking đã sẵn sàng chưa và có thể đổi sang phòng nào. */
export async function getCheckInOptions(id: string): Promise<CheckInOptions> {
  return (await api.get<CheckInOptions>(`/bookings/${id}/check-in-options`)).data
}

export interface SameDayList {
  date: string
  summary: {
    arrivals: { total: number; awaitingDeposit: number; ready: number; checkedIn: number }
    departures: { total: number; awaitingCheckOut: number; checkedOut: number }
  }
  /** Khách đến trong ngày (chưa cọc, đã xác nhận, đã nhận phòng). */
  arrivals: BookingListItem[]
  /** Khách đi trong ngày (đang ở, đã trả phòng). */
  departures: BookingListItem[]
}

/** UC15 — Danh sách khách đến và đi trong ngày (mặc định hôm nay, giờ Việt Nam). */
export async function getSameDayList(params: { date?: string }): Promise<SameDayList> {
  return (await api.get<SameDayList>('/front-desk/same-day', { params })).data
}

export interface GuestProfile {
  name: string
  email: string
  phone: string
  /** Khách từng đặt khi đã đăng nhập tài khoản. */
  hasAccount: boolean
  totalBookings: number
  /** Số booking đã trả phòng. */
  completedStays: number
  /** Ngày nhận phòng gần nhất (ISO), không tính booking đã huỷ. */
  lastCheckIn: string | null
}

export interface GuestListParams {
  q: string
  page: number
  limit: number
}

export interface GuestListPage {
  items: GuestProfile[]
  total: number
  page: number
  limit: number
}

/** UC14 — Tìm hồ sơ khách (gộp từ booking) theo tên, email, số điện thoại hoặc mã booking. */
export async function searchGuests(params: GuestListParams): Promise<GuestListPage> {
  return (await api.get<GuestListPage>('/guests', { params })).data
}

export type RoomOccupancy = 'FREE' | 'HELD' | 'RESERVED' | 'IN_HOUSE'

export interface RoomBoardBooking {
  code: string
  guestName: string
  status: string
  checkIn: string
  checkOut: string
}

export interface RoomBoardEntry {
  id: string
  roomNumber: string
  floor: number
  roomTypeId: string
  roomTypeName: string
  capacity: number
  /** Trạng thái vật lý hiện tại của phòng. */
  status: string
  /** Mức chiếm trong ngày đang xem. */
  occupancy: RoomOccupancy
  /** Trạng thái vật lý đáng hiển thị cho ngày đang xem (OCCUPIED/CLEANING chỉ hôm nay), null nếu không có. */
  physicalStatus: string | null
  booking: RoomBoardBooking | null
}

export interface RoomStatusBoard {
  date: string
  summary: {
    total: number
    free: number
    held: number
    reserved: number
    inHouse: number
    maintenance: number
    cleaning: number
  }
  rooms: RoomBoardEntry[]
}

export interface RoomStatusBoardParams {
  /** YYYY-MM-DD, giờ Việt Nam; bỏ trống = hôm nay. */
  date?: string
  floor?: number
  roomTypeId?: string
}

/** UC13 — Sơ đồ trạng thái phòng theo ngày cho lễ tân/quản lý. */
export async function getRoomStatusBoard(params: RoomStatusBoardParams): Promise<RoomStatusBoard> {
  return (await api.get<RoomStatusBoard>('/room-status-board', { params })).data
}

export type UpdateBookingInput = Partial<CreateBookingInput>

/** UC11 — Lễ tân/Quản lý sửa booking; server kiểm tra lại phòng trống và tính lại giá. */
export async function updateBooking(id: string, input: UpdateBookingInput): Promise<WalkInBooking> {
  return (await api.patch<WalkInBooking>(`/bookings/${id}`, input)).data
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

/** Issue ② — một khoản tiền về sau hạn giữ phòng, cần Manager đối soát/hoàn thủ công. */
export interface ReconciliationItem {
  id: string
  transactionRef: string
  purpose: 'DEPOSIT' | 'FINAL'
  amount: number
  providerTransactionRef?: string
  paidAt?: string
  bookingId: string
  bookingCode?: string
  bookingStatus?: string
  createdAt: string
}

export interface ReconciliationList {
  items: ReconciliationItem[]
  total: number
}

/** Danh sách các khoản tiền về muộn cần đối soát (Manager). */
export async function listReconciliation(): Promise<ReconciliationList> {
  return (await api.get<ReconciliationList>('/payments/reconciliation')).data
}

export interface ReconciledPayment {
  id: string
  transactionRef: string
  needsReconciliation: boolean
  reconciledAt: string
  reconciledBy: string
  reconciliationNote?: string
}

/** Đánh dấu một khoản đã đối soát (tiền đã xử lý ngoài hệ thống) kèm ghi chú. */
export async function reconcilePayment(id: string, note?: string): Promise<ReconciledPayment> {
  return (
    await api.post<ReconciledPayment>(
      `/payments/${id}/reconcile`,
      note === undefined ? {} : { note },
    )
  ).data
}
