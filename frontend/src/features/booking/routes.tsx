import type { RouteObject } from 'react-router'
import { Role } from '@/features/auth/api'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { EditBookingPage } from './pages/EditBookingPage'
import { BookingListPage } from './pages/BookingListPage'
import { BookingDetailPage } from './pages/BookingDetailPage'
import { CreateBookingPage } from './pages/CreateBookingPage'
import { MyBookingsPage } from './pages/MyBookingsPage'
import { RoomStatusBoardPage } from './pages/RoomStatusBoardPage'
import { FrontDeskPage } from './pages/FrontDeskPage'
import { GuestSearchPage } from './pages/GuestSearchPage'
import { PaymentReturnPage } from './pages/PaymentReturnPage'
import { SearchRoomsPage } from './pages/SearchRoomsPage'
import { WalkInBookingPage } from './pages/WalkInBookingPage'

/**
 * Màn đặt phòng hướng Guest/Customer (UC05, UC07/UC46, UC12, UC20, UC21) và các màn tại quầy
 * cho lễ tân: tạo/danh sách/sửa booking (UC08, UC10, UC11), sơ đồ phòng (UC13), tìm khách
 * (UC14), đến/đi trong ngày (UC15).
 * Để công khai: Guest chưa đăng nhập vẫn đặt được và tự thanh toán bằng mã booking.
 */
export const bookingRoutes: RouteObject[] = [
  { path: 'search', element: <SearchRoomsPage /> },
  { path: 'booking/new', element: <CreateBookingPage /> },
  { path: 'booking/:id', element: <BookingDetailPage /> },
  { path: 'my-bookings', element: <MyBookingsPage /> },
  {
    path: 'reception/front-desk',
    element: (
      <RequireAuth roles={[Role.Receptionist, Role.Manager]}>
        <FrontDeskPage />
      </RequireAuth>
    ),
  },
  {
    path: 'reception/guests',
    element: (
      <RequireAuth roles={[Role.Receptionist, Role.Manager]}>
        <GuestSearchPage />
      </RequireAuth>
    ),
  },
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
