import type { RouteObject } from 'react-router'
import { ExperiencesPage } from './pages/ExperiencesPage'

export const experienceRoutes: RouteObject[] = [
  { path: 'experiences', element: <ExperiencesPage /> },
]
