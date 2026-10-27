import { createBrowserRouter } from 'react-router'
import { accountRoutes } from '@/features/accounts/routes'
import { authRoutes } from '@/features/auth/routes'
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

import { PublicLayout } from '@/layouts/PublicLayout'
import { StaffLayout } from '@/layouts/StaffLayout'
import { HomePage } from '@/pages/HomePage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { partitionStaffRoutes } from './navigation'

/**
 * Mỗi feature export mảng route riêng rồi gộp ở đây. Route thuộc khu nhân viên (/staff, /manager,
 * /reception, /operations) được đặt trong khung nhân viên, phần còn lại trong khung khách; việc
 * tách theo tiền tố đường dẫn nên URL và RequireAuth của từng feature không đổi.
 */
const { staff, other } = partitionStaffRoutes([
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
])

export const router = createBrowserRouter([
  { element: <StaffLayout />, children: staff },
  {
    element: <PublicLayout />,
    children: [
      { index: true, element: <HomePage /> },
      ...other,
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
