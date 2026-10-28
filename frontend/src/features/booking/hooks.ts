import { useMutation, useQuery } from '@tanstack/react-query'
import {
  cancelBooking,
  createBooking,
  getBooking,
  holdBooking,
  initiateDeposit,
  initiateFinal,
  searchAvailability,
  submitBookingDetails,
  verifyVnpayReturn,
  type SearchAvailabilityParams,
} from './api'

/** UC05 — chỉ chạy khi đã có ngày và số khách hợp lệ. */
export function useAvailability(params: SearchAvailabilityParams | null) {
  return useQuery({
    queryKey: ['availability', params],
    queryFn: () => searchAvailability(params as SearchAvailabilityParams),
    enabled: params !== null,
  })
}

export function useCreateBooking() {
  return useMutation({ mutationFn: createBooking })
}

export function useHoldBooking() {
  return useMutation({ mutationFn: holdBooking })
}

export function useSubmitBookingDetails() {
  return useMutation({ mutationFn: submitBookingDetails })
}

/**
 * Đọc trạng thái authoritative của booking từ backend. `refetchInterval` để trang
 * kết quả thanh toán tự cập nhật khi IPN chốt CONFIRMED; dừng khi đã ở trạng thái cuối.
 */
export function useBooking(
  id: string,
  options: { code?: string; enabled?: boolean; poll?: boolean } = {},
) {
  const { code, enabled = true, poll = false } = options
  return useQuery({
    queryKey: ['booking', id, code ?? null],
    queryFn: () => getBooking(id, code === undefined ? {} : { code }),
    enabled: enabled && id.length > 0,
    retry: false,
    refetchInterval: poll
      ? (query) => {
          const status = query.state.data?.status
          const settled =
            status === 'CONFIRMED' ||
            status === 'CANCELLED' ||
            status === 'EXPIRED' ||
            status === 'CHECKED_IN' ||
            status === 'CHECKED_OUT'
          return settled ? false : 3000
        }
      : false,
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
