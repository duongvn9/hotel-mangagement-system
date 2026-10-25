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

import { PublicLayout } from '@/layouts/PublicLayout'
import { HomePage } from '@/pages/HomePage'
import { NotFoundPage } from '@/pages/NotFoundPage'

/**
 * Khung routing. Route theo role (Customer, Receptionist, Service Staff,
 * Operations Staff, Manager) thêm trong task "Layout chung, routing theo role".
 * Gợi ý: mỗi feature export mảng route riêng rồi gộp vào đây.
 */
export const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    children: [
      { index: true, element: <HomePage /> },
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
      // TODO(#18): Move staff dashboards into the H10 role layout when available.
      ...staffDashboardRoutes,
      ...maintenanceRoutes,
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
