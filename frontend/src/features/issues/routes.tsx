import type { RouteObject } from 'react-router'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { ReportIssuePage } from './pages/ReportIssuePage'

export const issueRoutes: RouteObject[] = [
  {
    path: '/customer/issues/report',
    element: (
      <RequireAuth roles={['CUSTOMER']}>
        <ReportIssuePage />
      </RequireAuth>
    ),
  },
]
