import type { RouteObject } from 'react-router'
import { Role } from '@/features/auth/api'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { CustomerHomePage } from './pages/CustomerHomePage'

/** Tổng quan của khách hàng, nằm trong khung làm việc (đoạn đầu `customer`). */
export const customerHomeRoutes: RouteObject[] = [
  {
    path: 'customer/dashboard',
    element: (
      <RequireAuth roles={[Role.Customer]}>
        <CustomerHomePage />
      </RequireAuth>
    ),
  },
]
