import { useMutation } from '@tanstack/react-query'
import { reportIssue } from './api'

export function useReportIssue() {
  return useMutation({ mutationFn: reportIssue, retry: false })
}
