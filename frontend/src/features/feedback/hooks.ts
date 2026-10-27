import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getMyStays, submitFeedback } from './api'

/** UC39 — chỉ Customer gọi được; hiện các lần lưu trú đã trả phòng của chính mình. */
export function useMyStays() {
  return useQuery({ queryKey: ['my-stays'], queryFn: getMyStays })
}

export function useSubmitFeedback() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: submitFeedback,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-stays'] }),
  })
}
