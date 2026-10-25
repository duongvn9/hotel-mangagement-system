import type { RouteObject } from 'react-router'
import { Role } from '@/features/auth/api'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { ReportFaultPage } from './pages/ReportFaultPage'

export const maintenanceRoutes: RouteObject[] = [
  {
    path: 'operations/maintenance/report',
    element: (
      <RequireAuth roles={[Role.OperationsStaff]}>
        <ReportFaultPage />
      </RequireAuth>
    ),
  },
]
