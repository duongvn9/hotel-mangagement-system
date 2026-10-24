import type { RouteObject } from 'react-router'
import { BookingDetailPage } from './pages/BookingDetailPage'
import { CreateBookingPage } from './pages/CreateBookingPage'
import { MyBookingsPage } from './pages/MyBookingsPage'
import { PaymentReturnPage } from './pages/PaymentReturnPage'
import { SearchRoomsPage } from './pages/SearchRoomsPage'

/**
 * Màn đặt phòng hướng Guest/Customer (UC05, UC07/UC46, UC12, UC20, UC21).
 * Để công khai: Guest chưa đăng nhập vẫn đặt được và tự thanh toán bằng mã booking.
 */
export const bookingRoutes: RouteObject[] = [
  { path: 'search', element: <SearchRoomsPage /> },
  { path: 'booking/new', element: <CreateBookingPage /> },
  { path: 'booking/:id', element: <BookingDetailPage /> },
  { path: 'my-bookings', element: <MyBookingsPage /> },
  { path: 'payment/vnpay-return', element: <PaymentReturnPage /> },
]
