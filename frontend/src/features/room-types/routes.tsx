import type { RouteObject } from 'react-router'
import { Role } from '@/features/auth/api'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { RoomTypesPage } from './pages/RoomTypesPage'

export const roomTypeRoutes: RouteObject[] = [
  {
    path: 'manager/room-types',
    element: (
      <RequireAuth roles={[Role.Manager]} permissions={['facility:manage']}>
        <RoomTypesPage />
      </RequireAuth>
    ),
  },
]
