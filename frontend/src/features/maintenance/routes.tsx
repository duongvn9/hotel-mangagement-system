import type { RouteObject } from 'react-router'
import { Role } from '@/features/auth/api'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { ReportFaultPage } from './pages/ReportFaultPage'
import { MaintenanceHistoryPage } from './pages/MaintenanceHistoryPage'
import { MaintenanceHistoryDetailPage } from './pages/MaintenanceHistoryDetailPage'

export const maintenanceRoutes: RouteObject[] = [
  {
    path: 'operations/maintenance/history',
    element: (
      <RequireAuth roles={[Role.OperationsStaff]}>
        <MaintenanceHistoryPage />
      </RequireAuth>
    ),
  },
  {
    path: 'operations/maintenance/history/:id',
    element: (
      <RequireAuth roles={[Role.OperationsStaff]}>
        <MaintenanceHistoryDetailPage />
      </RequireAuth>
    ),
  },
  {
    path: 'operations/maintenance/report',
    element: (
      <RequireAuth roles={[Role.OperationsStaff]}>
        <ReportFaultPage />
      </RequireAuth>
    ),
  },
]
