import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  addCheckoutCharge,
  cancelBooking,
  checkInBooking,
  checkOutBooking,
  createBooking,
  createWalkInBooking,
  initiateDeposit,
  getBookingCharges,
  getCheckInOptions,
  getRoomStatusBoard,
  getSameDayList,
  initiateFinal,
  listBookings,
  recordCashPayment,
  searchGuests,
  searchAvailability,
  updateBooking,
  verifyVnpayReturn,
  type AddChargeInput,
  type BookingListParams,
  type GuestListParams,
  type RoomReplacement,
  type RoomStatusBoardParams,
  type SearchAvailabilityParams,
  type UpdateBookingInput,
} from './api'

/** UC05 — chỉ chạy khi đã có ngày và số khách hợp lệ. */
export function useAvailability(params: SearchAvailabilityParams | null) {
  return useQuery({
    queryKey: ['availability', params],
    queryFn: () => searchAvailability(params as SearchAvailabilityParams),
    enabled: params !== null,
  })
}

export function useBookingList(params: BookingListParams) {
  return useQuery({
    queryKey: ['bookings', params],
    queryFn: () => listBookings(params),
    placeholderData: keepPreviousData,
  })
}

export function useSameDayList(date: string) {
  return useQuery({
    queryKey: ['same-day', date],
    queryFn: () => getSameDayList({ date }),
    placeholderData: keepPreviousData,
  })
}

/** UC14 — chỉ chạy khi đã có từ khoá hợp lệ. */
export function useGuestSearch(params: GuestListParams | null) {
  return useQuery({
    queryKey: ['guests', params],
    queryFn: () => searchGuests(params as GuestListParams),
    enabled: params !== null,
    placeholderData: keepPreviousData,
  })
}

export function useRoomStatusBoard(params: RoomStatusBoardParams) {
  return useQuery({
    queryKey: ['room-status-board', params],
    queryFn: () => getRoomStatusBoard(params),
    placeholderData: keepPreviousData,
  })
}

export function useCreateBooking() {
  return useMutation({ mutationFn: createBooking })
}

export function useCreateWalkInBooking() {
  return useMutation({ mutationFn: createWalkInBooking })
}

export function useUpdateBooking() {
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateBookingInput }) =>
      updateBooking(id, input),
  })
}

/** UC16 — sau khi nhận phòng làm mới danh sách đến/đi, sơ đồ phòng và danh sách booking. */
export function useCheckIn() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, replacements }: { id: string; replacements?: RoomReplacement[] }) =>
      checkInBooking(id, replacements),
    onSuccess: () =>
      Promise.all(
        ['same-day', 'room-status-board', 'bookings'].map((key) =>
          queryClient.invalidateQueries({ queryKey: [key] }),
        ),
      ),
  })
}

/** UC16 — chỉ chạy khi cần xem phòng nào chưa sẵn sàng (sau khi check-in bị chặn). */
export function useCheckInOptions(id: string | null) {
  return useQuery({
    queryKey: ['check-in-options', id],
    queryFn: () => getCheckInOptions(id as string),
    enabled: id !== null,
    retry: false,
  })
}

/** UC17 — chỉ chạy khi mở khung phụ phí của một booking. */
export function useBookingCharges(id: string | null) {
  return useQuery({
    queryKey: ['booking-charges', id],
    queryFn: () => getBookingCharges(id as string),
    enabled: id !== null,
  })
}

export function useAddCharge(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: AddChargeInput) => addCheckoutCharge(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['booking-charges', id] }),
  })
}

/** UC18 — xác nhận thu tiền mặt rồi làm mới hóa đơn của booking. */
export function useRecordCash(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (requestId: string) => recordCashPayment(id, requestId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['booking-charges', id] }),
  })
}

/** UC18 — sau khi trả phòng làm mới danh sách đến/đi, sơ đồ phòng, danh sách booking và hóa đơn. */
export function useCheckOut() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => checkOutBooking(id),
    onSuccess: () =>
      Promise.all(
        ['same-day', 'room-status-board', 'bookings', 'booking-charges'].map((key) =>
          queryClient.invalidateQueries({ queryKey: [key] }),
        ),
      ),
  })
}

export function useCancelBooking() {
  return useMutation({
    mutationFn: ({ id, code }: { id: string; code?: string }) =>
      cancelBooking(id, code === undefined ? {} : { code }),
  })
}

export function useInitiateDeposit() {
  return useMutation({ mutationFn: initiateDeposit })
}

export function useInitiateFinal() {
  return useMutation({ mutationFn: initiateFinal })
}

export function useVerifyReturn(rawQuery: string) {
  return useQuery({
    queryKey: ['vnpay-return', rawQuery],
    queryFn: () => verifyVnpayReturn(rawQuery),
    enabled: rawQuery.length > 0,
    retry: false,
  })
}
