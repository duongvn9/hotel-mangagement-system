import { createBrowserRouter } from 'react-router'
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
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
