import type { RouteObject } from 'react-router'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { RevenueReportPage } from './pages/RevenueReportPage'
import { OperationalReportPage } from './pages/OperationalReportPage'
export const reportRoutes: RouteObject[] = [
  {
    path: '/manager/reports/operational',
    element: (
      <RequireAuth roles={['MANAGER']}>
        <OperationalReportPage />
      </RequireAuth>
    ),
  },
  {
    path: '/manager/reports/revenue',
    element: (
      <RequireAuth roles={['MANAGER']}>
        <RevenueReportPage />
      </RequireAuth>
    ),
  },
]
