import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { queryClient } from './query-client'
import { router } from './router'

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  )
}
