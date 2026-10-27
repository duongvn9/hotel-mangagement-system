import type { RouteObject } from 'react-router'
import { Role } from '@/features/auth/api'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { EditBookingPage } from './pages/EditBookingPage'
import { BookingListPage } from './pages/BookingListPage'
import { BookingDetailPage } from './pages/BookingDetailPage'
import { CreateBookingPage } from './pages/CreateBookingPage'
import { MyBookingsPage } from './pages/MyBookingsPage'
import { RoomStatusBoardPage } from './pages/RoomStatusBoardPage'
import { PaymentReturnPage } from './pages/PaymentReturnPage'
import { SearchRoomsPage } from './pages/SearchRoomsPage'
import { WalkInBookingPage } from './pages/WalkInBookingPage'

/**
 * Màn đặt phòng hướng Guest/Customer (UC05, UC07/UC46, UC12, UC20, UC21) và booking tại quầy cho lễ tân (UC08, UC10, UC11) và sơ đồ phòng (UC13).
 * Để công khai: Guest chưa đăng nhập vẫn đặt được và tự thanh toán bằng mã booking.
 */
export const bookingRoutes: RouteObject[] = [
  { path: 'search', element: <SearchRoomsPage /> },
  { path: 'booking/new', element: <CreateBookingPage /> },
  { path: 'booking/:id', element: <BookingDetailPage /> },
  { path: 'my-bookings', element: <MyBookingsPage /> },
  {
    path: 'reception/rooms',
    element: (
      <RequireAuth roles={[Role.Receptionist, Role.Manager]}>
        <RoomStatusBoardPage />
      </RequireAuth>
    ),
  },
  {
    path: 'reception/bookings',
    element: (
      <RequireAuth roles={[Role.Receptionist, Role.Manager]}>
        <BookingListPage />
      </RequireAuth>
    ),
  },
  {
    path: 'reception/bookings/:code/edit',
    element: (
      <RequireAuth roles={[Role.Receptionist, Role.Manager]}>
        <EditBookingPage />
      </RequireAuth>
    ),
  },
  {
    path: 'reception/booking/new',
    element: (
      <RequireAuth roles={[Role.Receptionist, Role.Manager]}>
        <WalkInBookingPage />
      </RequireAuth>
    ),
  },
  { path: 'payment/vnpay-return', element: <PaymentReturnPage /> },
]
