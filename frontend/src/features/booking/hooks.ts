import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'
import {
  cancelBooking,
  createBooking,
  createWalkInBooking,
  initiateDeposit,
  initiateFinal,
  listBookings,
  searchAvailability,
  updateBooking,
  verifyVnpayReturn,
  type BookingListParams,
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
