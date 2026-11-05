import { createBrowserRouter } from 'react-router'
import { accountRoutes } from '@/features/accounts/routes'
import { authOnlyRoutes, authRoutes } from '@/features/auth/routes'
import { bookingRoutes } from '@/features/booking/routes'
import { feedbackRoutes } from '@/features/feedback/routes'
import { issueRoutes } from '@/features/issues/routes'
import { roleRoutes } from '@/features/roles/routes'
import { roomTypeRoutes } from '@/features/room-types/routes'
import { roomRoutes } from '@/features/rooms/routes'
import { amenityRoutes } from '@/features/amenities/routes'
import { serviceRoutes } from '@/features/services/routes'
import { serviceOrderRoutes } from '@/features/service-orders/routes'
import { taskRoutes } from '@/features/tasks/routes'
import { staffDashboardRoutes } from '@/features/staff-dashboards/routes'
import { maintenanceRoutes } from '@/features/maintenance/routes'
import { taskSupervisionRoutes } from '@/features/task-supervision/routes'
import { reportRoutes } from '@/features/reports/routes'
import { dashboardRoutes } from '@/features/dashboard/routes'
import { experienceRoutes } from '@/features/experiences/routes'

import { PublicLayout } from '@/layouts/PublicLayout'
import { WorkspaceShell } from '@/layouts/WorkspaceShell'
import { HomePage } from '@/pages/HomePage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { partitionWorkspaceRoutes } from './navigation'

/**
 * Mỗi feature export mảng route riêng rồi gộp ở đây. Route thuộc khu làm việc (nhân viên và tài
 * khoản khách) được đặt trong WorkspaceShell, phần còn lại trong khung khách; việc tách theo tiền
 * tố đường dẫn nên URL và RequireAuth của từng feature không đổi.
 */
const { workspace, other } = partitionWorkspaceRoutes([
  ...bookingRoutes,
  ...authRoutes,
  ...accountRoutes,
  ...roleRoutes,
  ...roomTypeRoutes,
  ...roomRoutes,
  ...amenityRoutes,
  ...serviceRoutes,
  ...serviceOrderRoutes,
  ...feedbackRoutes,
  ...issueRoutes,
  ...taskRoutes,
  ...staffDashboardRoutes,
  ...maintenanceRoutes,
  ...taskSupervisionRoutes,
  ...reportRoutes,
  ...dashboardRoutes,
  ...experienceRoutes,
])

export const router = createBrowserRouter([
  { element: <WorkspaceShell />, children: workspace },
  { children: authOnlyRoutes },
  {
    element: <PublicLayout />,
    children: [
      { index: true, element: <HomePage /> },
      ...other,
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
