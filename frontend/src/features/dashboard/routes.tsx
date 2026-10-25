import type { RouteObject } from 'react-router'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { ManagerDashboardPage } from './pages/ManagerDashboardPage'
export const dashboardRoutes: RouteObject[] = [
  {
    path: '/manager/dashboard',
    element: (
      <RequireAuth roles={['MANAGER']}>
        <ManagerDashboardPage />
      </RequireAuth>
    ),
  },
]
