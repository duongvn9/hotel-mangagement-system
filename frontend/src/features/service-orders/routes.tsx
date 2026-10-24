import type { RouteObject } from 'react-router'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { NewServiceOrderPage } from './pages/NewServiceOrderPage'
import { ServiceOrdersPage } from './pages/ServiceOrdersPage'
import { ServiceOrderDetailPage } from './pages/ServiceOrderDetailPage'

export const serviceOrderRoutes: RouteObject[] = [
  {
    path: '/customer/service-orders',
    element: (
      <RequireAuth roles={['CUSTOMER']}>
        <ServiceOrdersPage />
      </RequireAuth>
    ),
  },
  {
    path: '/customer/service-orders/new',
    element: (
      <RequireAuth roles={['CUSTOMER']}>
        <NewServiceOrderPage />
      </RequireAuth>
    ),
  },
  {
    path: '/customer/service-orders/:id',
    element: (
      <RequireAuth roles={['CUSTOMER']}>
        <ServiceOrderDetailPage />
      </RequireAuth>
    ),
  },
]
