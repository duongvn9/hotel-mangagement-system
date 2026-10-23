import type { RouteObject } from 'react-router'
import { Role } from '@/features/auth/api'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { RoomsPage } from './pages/RoomsPage'

export const roomRoutes: RouteObject[] = [
  {
    path: 'manager/rooms',
    element: (
      <RequireAuth roles={[Role.Manager]} permissions={['facility:manage']}>
        <RoomsPage />
      </RequireAuth>
    ),
  },
]
