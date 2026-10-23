import type { RouteObject } from 'react-router'
import { Role } from '@/features/auth/api'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { OperationsStaffDashboardPage, ServiceStaffDashboardPage } from './StaffDashboardPage'

export const staffDashboardRoutes: RouteObject[] = [
  {
    path: '/staff/service/dashboard',
    element: (
      <RequireAuth roles={[Role.ServiceStaff]}>
        <ServiceStaffDashboardPage />
      </RequireAuth>
    ),
  },
  {
    path: '/staff/operations/dashboard',
    element: (
      <RequireAuth roles={[Role.OperationsStaff]}>
        <OperationsStaffDashboardPage />
      </RequireAuth>
    ),
  },
]
