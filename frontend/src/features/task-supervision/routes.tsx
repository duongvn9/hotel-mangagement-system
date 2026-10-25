import type { RouteObject } from 'react-router'
import { Role } from '@/features/auth/api'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { TaskQueuesPage } from './pages/TaskQueuesPage'
import { TaskQueueDetailPage } from './pages/TaskQueueDetailPage'

export const taskSupervisionRoutes: RouteObject[] = [
  {
    path: 'manager/task-queues',
    element: (
      <RequireAuth roles={[Role.Manager]}>
        <TaskQueuesPage />
      </RequireAuth>
    ),
  },
  {
    path: 'manager/task-queues/:taskId',
    element: (
      <RequireAuth roles={[Role.Manager]}>
        <TaskQueueDetailPage />
      </RequireAuth>
    ),
  },
]
