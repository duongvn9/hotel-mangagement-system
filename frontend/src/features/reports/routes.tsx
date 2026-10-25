import type { RouteObject } from 'react-router'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { RevenueReportPage } from './pages/RevenueReportPage'
export const reportRoutes: RouteObject[] = [
  {
    path: '/manager/reports/revenue',
    element: (
      <RequireAuth roles={['MANAGER']}>
        <RevenueReportPage />
      </RequireAuth>
    ),
  },
]
