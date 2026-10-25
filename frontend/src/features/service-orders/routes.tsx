import type { RouteObject } from 'react-router'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { NewServiceOrderPage } from './pages/NewServiceOrderPage'
import { ServiceOrdersPage } from './pages/ServiceOrdersPage'
import { ServiceOrderDetailPage } from './pages/ServiceOrderDetailPage'

import { StaffServiceOrdersPage } from './pages/StaffServiceOrdersPage'
import { StaffServiceOrderDetailPage } from './pages/StaffServiceOrderDetailPage'

import { ServiceHistoryPage, ServiceHistoryDetailPage } from './pages/ServiceHistoryPage'

export const serviceOrderRoutes: RouteObject[] = [
  {
    path: '/staff/service-history',
    element: (
      <RequireAuth roles={['SERVICE_STAFF']}>
        <ServiceHistoryPage />
      </RequireAuth>
    ),
  },
  {
    path: '/staff/service-history/:id',
    element: (
      <RequireAuth roles={['SERVICE_STAFF']}>
        <ServiceHistoryDetailPage />
      </RequireAuth>
    ),
  },
  {
    path: '/staff/service-orders',
    element: (
      <RequireAuth roles={['RECEPTIONIST']}>
        <StaffServiceOrdersPage />
      </RequireAuth>
    ),
  },
  {
    path: '/staff/service-orders/:id',
    element: (
      <RequireAuth roles={['RECEPTIONIST']}>
        <StaffServiceOrderDetailPage />
      </RequireAuth>
    ),
  },
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
