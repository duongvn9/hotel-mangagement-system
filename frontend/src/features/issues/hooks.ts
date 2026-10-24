import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/auth-context'
import { getIssue, listIssues, normalizeIssueQuery, reportIssue, type IssueQuery } from './api'

export const issueKeys = {
  scope: (id?: string, role?: string) => ['issues', id, role] as const,
  list: (id: string | undefined, role: string | undefined, query: IssueQuery) =>
    [...issueKeys.scope(id, role), 'list', normalizeIssueQuery(query)] as const,
  detail: (id: string | undefined, role: string | undefined, issueId: string) =>
    [...issueKeys.scope(id, role), 'detail', issueId] as const,
}

export function useIssues(query: IssueQuery) {
  const { me } = useAuth()
  return useQuery({
    queryKey: issueKeys.list(me?.id, me?.role, query),
    queryFn: () => listIssues(query),
    enabled: Boolean(me),
    retry: false,
  })
}

export function useIssue(id: string) {
  const { me } = useAuth()
  return useQuery({
    queryKey: issueKeys.detail(me?.id, me?.role, id),
    queryFn: () => getIssue(id),
    enabled: Boolean(me && id),
    retry: false,
  })
}

export function useReportIssue() {
  const { me } = useAuth()
  const client = useQueryClient()
  return useMutation({
    mutationFn: reportIssue,
    retry: false,
    onSuccess: () => client.invalidateQueries({ queryKey: issueKeys.scope(me?.id, me?.role) }),
  })
}
