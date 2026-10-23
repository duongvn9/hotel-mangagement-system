import type { RouteObject } from 'react-router'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { AssignedTasksPage } from './pages/AssignedTasksPage'
import { AssignedTaskDetailPage } from './pages/AssignedTaskDetailPage'

export const taskRoles = ['SERVICE_STAFF', 'OPERATIONS_STAFF']
export const taskPermissions = ['task:execute']

export const taskRoutes: RouteObject[] = [
  {
    path: '/staff/tasks',
    element: (
      <RequireAuth roles={taskRoles} permissions={taskPermissions}>
        <AssignedTasksPage />
      </RequireAuth>
    ),
  },
  {
    path: '/staff/tasks/:id',
    element: (
      <RequireAuth roles={taskRoles} permissions={taskPermissions}>
        <AssignedTaskDetailPage />
      </RequireAuth>
    ),
  },
]
