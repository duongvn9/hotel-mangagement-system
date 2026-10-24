import type { RouteObject } from 'react-router'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { ReportIssuePage } from './pages/ReportIssuePage'
import { IssueListPage } from './pages/IssueListPage'
import { IssueDetailPage } from './pages/IssueDetailPage'
import { issueViews, type IssueRole } from './presentation'

export const issueRoutes: RouteObject[] = [
  {
    path: '/customer/issues/report',
    element: (
      <RequireAuth roles={['CUSTOMER']}>
        <ReportIssuePage />
      </RequireAuth>
    ),
  },
  ...(Object.keys(issueViews) as IssueRole[]).flatMap((role) => [
    {
      path: issueViews[role].path,
      element: (
        <RequireAuth roles={[role]}>
          <IssueListPage key={role} role={role} />
        </RequireAuth>
      ),
    },
    {
      path: `${issueViews[role].path}/:id`,
      element: (
        <RequireAuth roles={[role]}>
          <IssueDetailPage role={role} />
        </RequireAuth>
      ),
    },
  ]),
]
