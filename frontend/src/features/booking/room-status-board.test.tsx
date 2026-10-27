import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { api } from '@/lib/api-client'
import { ME, renderWithAuth } from '@/features/auth/test-utils'
import { bookingRoutes } from './routes'
import type { RoomStatusBoard } from './api'
import { todayISO } from './utils'

const receptionist = { ...ME, id: 'u2', email: 'reception@hms.local', role: 'RECEPTIONIST' }

const entry = (
  id: string,
  roomNumber: string,
  floor: number,
  overrides: Partial<RoomStatusBoard['rooms'][number]> = {},
): RoomStatusBoard['rooms'][number] => ({
  id,
  roomNumber,
  floor,
  roomTypeId: 't1',
  roomTypeName: 'Deluxe',
  capacity: 3,
  status: 'AVAILABLE',
  occupancy: 'FREE',
  physicalStatus: null,
  booking: null,
  ...overrides,
})

const board = (date = todayISO()): RoomStatusBoard => ({
  date,
  summary: { total: 6, free: 2, held: 1, reserved: 1, inHouse: 1, maintenance: 1, cleaning: 1 },
  rooms: [
    entry('r1', '101', 1, {
      occupancy: 'IN_HOUSE',
      booking: {
        code: 'BKIN',
        guestName: 'Nguyễn Văn A',
        status: 'CHECKED_IN',
        checkIn: '2099-01-09T17:00:00.000Z',
        checkOut: '2099-01-11T17:00:00.000Z',
      },
    }),
    entry('r2', '102', 1, {
      occupancy: 'RESERVED',
      booking: {
        code: 'BKRS',
        guestName: 'Trần Thị B',
        status: 'CONFIRMED',
        checkIn: '2099-01-09T17:00:00.000Z',
        checkOut: '2099-01-11T17:00:00.000Z',
      },
    }),
    entry('r3', '201', 2, {
      occupancy: 'HELD',
      roomTypeId: 't2',
      roomTypeName: 'Suite',
      booking: {
        code: 'BKHD',
        guestName: 'Lê C',
        status: 'PENDING_DEPOSIT',
        checkIn: '2099-01-09T17:00:00.000Z',
        checkOut: '2099-01-11T17:00:00.000Z',
      },
    }),
    entry('r4', '202', 2, { roomTypeId: 't2', roomTypeName: 'Suite' }),
    entry('r5', '301', 3, { status: 'MAINTENANCE', physicalStatus: 'MAINTENANCE' }),
    entry('r6', '302', 3, { status: 'CLEANING', physicalStatus: 'CLEANING' }),
  ],
})

function renderPage(role = receptionist) {
  return renderWithAuth(bookingRoutes, {
    path: '/reception/rooms',
    auth: { me: role, status: 'authenticated' },
  })
}

describe('RoomStatusBoardPage', () => {
  it('blocks roles other than receptionist/manager', () => {
    renderPage({ ...receptionist, role: 'CUSTOMER' })
    expect(screen.getByText('Không có quyền truy cập')).toBeInTheDocument()
  })

  it('shows the summary and rooms grouped by floor with status and booking', async () => {
    const get = vi.spyOn(api, 'get').mockResolvedValue({ data: board() })
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Tầng 1' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Tầng 2' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Tầng 3' })).toBeInTheDocument()
    expect(get).toHaveBeenCalledWith('/room-status-board', { params: { date: todayISO() } })

    const summary = within(screen.getByLabelText('Tổng hợp'))
    for (const text of [
      'Trống: 2',
      'Giữ chỗ: 1',
      'Đã đặt: 1',
      'Đang ở: 1',
      'Bảo trì: 1',
      'Đang dọn: 1',
    ]) {
      expect(summary.getByText(text)).toBeInTheDocument()
    }

    const room101 = within(screen.getByRole('listitem', { name: 'Phòng 101' }))
    expect(room101.getByText('Đang ở')).toBeInTheDocument()
    expect(room101.getByText('BKIN')).toBeInTheDocument()
    expect(room101.getByText('Nguyễn Văn A')).toBeInTheDocument()
    expect(
      within(screen.getByRole('listitem', { name: 'Phòng 102' })).getByText('Đã đặt'),
    ).toBeInTheDocument()
    expect(
      within(screen.getByRole('listitem', { name: 'Phòng 201' })).getByText('Giữ chỗ'),
    ).toBeInTheDocument()
    expect(
      within(screen.getByRole('listitem', { name: 'Phòng 202' })).getByText('Trống'),
    ).toBeInTheDocument()
    expect(
      within(screen.getByRole('listitem', { name: 'Phòng 301' })).getByText('Bảo trì'),
    ).toBeInTheDocument()
    expect(
      within(screen.getByRole('listitem', { name: 'Phòng 302' })).getByText('Đang dọn'),
    ).toBeInTheDocument()
  })

  it('reloads the board for another day', async () => {
    const get = vi.spyOn(api, 'get').mockResolvedValue({ data: board() })
    renderPage()
    await screen.findByRole('heading', { name: 'Tầng 1' })

    fireEvent.change(screen.getByLabelText(/^Ngày/), { target: { value: '2099-01-10' } })
    await waitFor(() =>
      expect(get).toHaveBeenLastCalledWith('/room-status-board', {
        params: { date: '2099-01-10' },
      }),
    )
  })

  it('filters by floor and room type on the client', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({ data: board() })
    renderPage()
    await screen.findByRole('heading', { name: 'Tầng 1' })

    fireEvent.change(screen.getByLabelText('Tầng'), { target: { value: '2' } })
    expect(screen.queryByRole('heading', { name: 'Tầng 1' })).not.toBeInTheDocument()
    expect(screen.getByRole('listitem', { name: 'Phòng 201' })).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Tầng'), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText('Loại phòng'), { target: { value: 't1' } })
    expect(screen.getByRole('listitem', { name: 'Phòng 101' })).toBeInTheDocument()
    expect(screen.queryByRole('listitem', { name: 'Phòng 201' })).not.toBeInTheDocument()
  })

  it('shows an empty state and an error state', async () => {
    vi.spyOn(api, 'get').mockResolvedValueOnce({
      data: { date: todayISO(), summary: { ...board().summary, total: 0 }, rooms: [] },
    })
    const empty = renderPage()
    expect(await screen.findByText('Không có phòng nào để hiển thị.')).toBeInTheDocument()
    empty.unmount()

    vi.spyOn(api, 'get').mockRejectedValue({
      isAxiosError: true,
      response: { status: 500, data: { message: 'Boom' } },
    })
    renderPage()
    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })
})
