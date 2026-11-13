import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { api } from '@/lib/api-client'
import { ME, renderWithAuth } from '@/features/auth/test-utils'
import { bookingRoutes } from './routes'
import type { BookingListItem, CheckInOptions, SameDayList } from './api'
import { todayISO } from './utils'

const receptionist = { ...ME, id: 'u2', email: 'reception@hms.local', role: 'RECEPTIONIST' }

const row = (id: string, code: string, status: string, room: string): BookingListItem => ({
  id,
  code,
  status,
  guestName: `Khách ${code}`,
  guestEmail: `${code.toLowerCase()}@example.test`,
  guestPhone: '0900000001',
  rooms: [{ id: `room-${id}`, roomNumber: room, roomTypeName: 'Deluxe' }],
  checkIn: '2099-01-09T17:00:00.000Z',
  checkOut: '2099-01-11T17:00:00.000Z',
  adultCount: 2,
  childCount: 1,
  source: 'ONLINE',
  roomTotal: 2_000_000,
  createdAt: '2099-01-01T00:00:00.000Z',
  walkIn: false,
})

const list = (): SameDayList => ({
  date: todayISO(),
  summary: {
    arrivals: { total: 3, awaitingDeposit: 1, ready: 1, checkedIn: 1 },
    departures: { total: 1, awaitingCheckOut: 1, checkedOut: 0 },
  },
  arrivals: [
    row('a1', 'ARP', 'PENDING_DEPOSIT', '101'),
    row('a2', 'ARC', 'CONFIRMED', '102'),
    row('a3', 'ARI', 'CHECKED_IN', '103'),
  ],
  departures: [row('d1', 'DPI', 'CHECKED_IN', '201')],
})

const options = (
  replacements: { id: string; roomNumber: string; floor: number }[],
): CheckInOptions => ({
  bookingId: 'a2',
  code: 'ARC',
  rooms: [
    {
      id: 'room-a2',
      roomNumber: '102',
      roomTypeName: 'Deluxe',
      ready: false,
      status: 'CLEANING',
      replacements,
    },
  ],
})

const conflict = (message: string) => ({
  isAxiosError: true,
  response: { status: 409, data: { message } },
})

function mockPosts() {
  return vi.spyOn(api, 'post').mockResolvedValue({ data: { id: 'a2' } })
}

const photoFile = (name = 'cccd.jpg') => new File(['x'], name, { type: 'image/jpeg' })

/** Pick one or more ID photos in a single selection and wait for the previews. */
async function chooseEvidence(...names: string[]) {
  const files = (names.length > 0 ? names : ['cccd.jpg']).map((name) => photoFile(name))
  fireEvent.change(screen.getByLabelText('Ảnh CCCD/giấy tờ'), { target: { files } })
  await screen.findByAltText('Ảnh giấy tờ 1')
}

const CHECKS = ['Đã đối chiếu họ tên', 'Đã đối chiếu số điện thoại', 'Đã đối chiếu số khách']

function tickChecks() {
  for (const name of CHECKS) fireEvent.click(screen.getByRole('checkbox', { name }))
}

/** Tick every verification box and attach an ID photo. */
async function prepareCheckIn(name?: string) {
  tickChecks()
  await chooseEvidence(...(name ? [name] : []))
}

/** Multipart body of the `n`th check-in call (0-based). */
function sentForm(post: { mock: { calls: unknown[][] } }, n = 0) {
  const call = post.mock.calls.filter(([url]) => url === '/bookings/a2/check-in')[n]
  return call?.[1] as FormData
}

function renderPage() {
  return renderWithAuth(bookingRoutes, {
    path: '/reception/front-desk',
    auth: { me: receptionist, status: 'authenticated' },
  })
}

function mockGet(checkInOptions?: CheckInOptions) {
  return vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
    if (url === '/front-desk/same-day') return { data: list() }
    if (url === '/bookings/a2/check-in-options' && checkInOptions) return { data: checkInOptions }
    throw new Error(`unexpected GET ${url}`)
  })
}

const arrival = () => within(screen.getByRole('listitem', { name: 'ARC' }))

/** Tick the checks, attach the ID photo, then press the confirm button in the dialog. */
async function confirmCheckIn() {
  await prepareCheckIn()
  fireEvent.click(await screen.findByRole('button', { name: 'Xác nhận nhận phòng' }))
  // Hộp thoại ẩn phần còn lại của trang cho tới khi đóng.
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
}

describe('Check In from the same-day list', () => {
  it('shows the Check In button only for confirmed arrivals', async () => {
    mockGet()
    renderPage()
    await screen.findByRole('heading', { name: 'Khách đến (3)' })
    expect(screen.getAllByRole('button', { name: 'Check In' })).toHaveLength(1)
    expect(arrival().getByRole('button', { name: 'Check In' })).toBeInTheDocument()
    expect(
      within(screen.getByRole('listitem', { name: 'ARP' })).queryByRole('button', {
        name: 'Check In',
      }),
    ).not.toBeInTheDocument()
  })

  it('asks the receptionist to confirm the guest details before checking in', async () => {
    mockGet()
    const post = vi.spyOn(api, 'post').mockResolvedValue({ data: { id: 'a2' } })
    renderPage()
    await screen.findByRole('heading', { name: 'Khách đến (3)' })

    fireEvent.click(arrival().getByRole('button', { name: 'Check In' }))

    const dialog = within(await screen.findByRole('dialog', { name: /Xác nhận nhận phòng/ }))
    expect(dialog.getByText('Khách ARC')).toBeInTheDocument()
    expect(dialog.getByText('0900000001')).toBeInTheDocument()
    expect(dialog.getByText('arc@example.test')).toBeInTheDocument()
    expect(dialog.getByText('102 · Deluxe')).toBeInTheDocument()
    expect(dialog.getByText('2 người lớn · 1 trẻ em')).toBeInTheDocument()
    expect(dialog.getByText('Nhận phòng')).toBeInTheDocument()
    expect(dialog.getByText('Trả phòng')).toBeInTheDocument()
    // Chưa nhận phòng cho tới khi lễ tân xác nhận.
    expect(post).not.toHaveBeenCalled()
  })

  it('does not check in when the receptionist cancels the confirmation', async () => {
    mockGet()
    const post = vi.spyOn(api, 'post').mockResolvedValue({ data: { id: 'a2' } })
    renderPage()
    await screen.findByRole('heading', { name: 'Khách đến (3)' })

    fireEvent.click(arrival().getByRole('button', { name: 'Check In' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Hủy' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(post).not.toHaveBeenCalled()
  })

  it('shows a missing phone or e-mail as a dash so the desk can ask for it', async () => {
    vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
      if (url === '/front-desk/same-day') {
        const data = list()
        data.arrivals[1] = {
          ...data.arrivals[1],
          guestPhone: '',
          guestEmail: '',
        } as BookingListItem
        return { data }
      }
      throw new Error(`unexpected GET ${url}`)
    })
    renderPage()
    await screen.findByRole('heading', { name: 'Khách đến (3)' })

    fireEvent.click(arrival().getByRole('button', { name: 'Check In' }))

    const dialog = within(await screen.findByRole('dialog'))
    expect(dialog.getAllByText('—')).toHaveLength(2)
  })

  it('checks the guest in and reloads the list', async () => {
    const get = mockGet()
    const post = mockPosts()
    renderPage()
    await screen.findByRole('heading', { name: 'Khách đến (3)' })
    const before = get.mock.calls.length

    fireEvent.click(arrival().getByRole('button', { name: 'Check In' }))
    await confirmCheckIn()
    await waitFor(() => expect(sentForm(post)).toBeInstanceOf(FormData))
    await waitFor(() => expect(get.mock.calls.length).toBeGreaterThan(before))
  })

  it('will not confirm until a photo is attached and every check is ticked', async () => {
    mockGet()
    mockPosts()
    renderPage()
    await screen.findByRole('heading', { name: 'Khách đến (3)' })

    fireEvent.click(arrival().getByRole('button', { name: 'Check In' }))

    const dialog = within(await screen.findByRole('dialog', { name: /Xác nhận nhận phòng/ }))
    const confirm = dialog.getByRole('button', { name: 'Xác nhận nhận phòng' })
    expect(confirm).toBeDisabled()

    await chooseEvidence()
    expect(confirm).toBeDisabled()

    fireEvent.click(dialog.getByRole('checkbox', { name: CHECKS[0] }))
    fireEvent.click(dialog.getByRole('checkbox', { name: CHECKS[1] }))
    expect(confirm).toBeDisabled()

    fireEvent.click(dialog.getByRole('checkbox', { name: CHECKS[2] }))
    expect(confirm).toBeEnabled()

    fireEvent.click(dialog.getByRole('checkbox', { name: CHECKS[0] }))
    expect(confirm).toBeDisabled()
  })

  it('needs at least one photo, and accepts up to five', async () => {
    mockGet()
    const post = mockPosts()
    renderPage()
    await screen.findByRole('heading', { name: 'Khách đến (3)' })

    fireEvent.click(arrival().getByRole('button', { name: 'Check In' }))
    const dialog = within(await screen.findByRole('dialog', { name: /Xác nhận nhận phòng/ }))
    const confirm = dialog.getByRole('button', { name: 'Xác nhận nhận phòng' })
    tickChecks()
    expect(confirm).toBeDisabled()

    await chooseEvidence('1.jpg', '2.jpg', '3.jpg')
    expect(dialog.getByText('3 / 5 ảnh')).toBeInTheDocument()
    expect(confirm).toBeEnabled()

    // Photos beyond the fifth are dropped.
    fireEvent.change(dialog.getByLabelText('Ảnh CCCD/giấy tờ'), {
      target: { files: ['4.jpg', '5.jpg', '6.jpg'].map((name) => photoFile(name)) },
    })
    await waitFor(() => expect(dialog.getByText('5 / 5 ảnh')).toBeInTheDocument())

    fireEvent.click(confirm)
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1))
    const names = sentForm(post)
      .getAll('evidence')
      .map((file) => (file as File).name)
    expect(names).toEqual(['1.jpg', '2.jpg', '3.jpg', '4.jpg', '5.jpg'])
  })

  it('blocks confirming again once every photo has been removed', async () => {
    mockGet()
    mockPosts()
    renderPage()
    await screen.findByRole('heading', { name: 'Khách đến (3)' })

    fireEvent.click(arrival().getByRole('button', { name: 'Check In' }))
    const dialog = within(await screen.findByRole('dialog', { name: /Xác nhận nhận phòng/ }))
    await prepareCheckIn()
    const confirm = dialog.getByRole('button', { name: 'Xác nhận nhận phòng' })
    expect(confirm).toBeEnabled()

    fireEvent.click(dialog.getByRole('button', { name: 'Bỏ ảnh 1' }))
    expect(confirm).toBeDisabled()
  })

  it('sends the photo with the check-in in one multipart request', async () => {
    mockGet()
    const post = mockPosts()
    renderPage()
    await screen.findByRole('heading', { name: 'Khách đến (3)' })

    fireEvent.click(arrival().getByRole('button', { name: 'Check In' }))
    await prepareCheckIn('front.jpg')
    fireEvent.click(await screen.findByRole('button', { name: 'Xác nhận nhận phòng' }))

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1))
    expect(post.mock.calls[0][0]).toBe('/bookings/a2/check-in')
    const form = sentForm(post)
    expect((form.get('evidence') as File).name).toBe('front.jpg')
    expect(form.get('replacements')).toBeNull()
  })

  it('shows no photo from an earlier attempt when the dialog is opened again', async () => {
    mockGet()
    vi.spyOn(api, 'post').mockRejectedValue(conflict('Too early to check in'))
    renderPage()
    await screen.findByRole('heading', { name: 'Khách đến (3)' })

    fireEvent.click(arrival().getByRole('button', { name: 'Check In' }))
    await prepareCheckIn()
    fireEvent.click(await screen.findByRole('button', { name: 'Xác nhận nhận phòng' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    fireEvent.click(arrival().getByRole('button', { name: 'Check In' }))
    const dialog = within(await screen.findByRole('dialog', { name: /Xác nhận nhận phòng/ }))
    expect(dialog.queryByAltText('Ảnh giấy tờ 1')).not.toBeInTheDocument()
    for (const name of CHECKS) {
      expect(dialog.getByRole('checkbox', { name })).not.toBeChecked()
    }
    expect(dialog.getByRole('button', { name: 'Xác nhận nhận phòng' })).toBeDisabled()
  })

  it('checks in with the newest photo after a failed attempt', async () => {
    mockGet()
    const post = vi
      .spyOn(api, 'post')
      .mockRejectedValueOnce(conflict('Too early to check in'))
      .mockResolvedValue({ data: { id: 'a2' } })
    renderPage()
    await screen.findByRole('heading', { name: 'Khách đến (3)' })

    fireEvent.click(arrival().getByRole('button', { name: 'Check In' }))
    await prepareCheckIn('blurry.jpg')
    fireEvent.click(await screen.findByRole('button', { name: 'Xác nhận nhận phòng' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    fireEvent.click(arrival().getByRole('button', { name: 'Check In' }))
    await prepareCheckIn('sharp.jpg')
    fireEvent.click(await screen.findByRole('button', { name: 'Xác nhận nhận phòng' }))

    await waitFor(() => expect(post).toHaveBeenCalledTimes(2))
    expect((sentForm(post, 1).get('evidence') as File).name).toBe('sharp.jpg')
  })

  it('offers replacement rooms when a room is not ready and checks in with the swap', async () => {
    mockGet(
      options([
        { id: 'room-x', roomNumber: '103', floor: 1 },
        { id: 'room-y', roomNumber: '104', floor: 1 },
      ]),
    )
    const post = vi
      .spyOn(api, 'post')
      .mockRejectedValueOnce(conflict('Rooms not ready: 102 (CLEANING)'))
      .mockResolvedValue({ data: { id: 'a2' } })
    renderPage()
    await screen.findByRole('heading', { name: 'Khách đến (3)' })

    fireEvent.click(arrival().getByRole('button', { name: 'Check In' }))
    await confirmCheckIn()
    expect(await arrival().findByText(/Phòng 102 đang dọn/)).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Rooms not ready: 102 (CLEANING)')

    const confirm = arrival().getByRole('button', { name: 'Đổi phòng và Check In' })
    expect(confirm).toBeDisabled()
    fireEvent.change(arrival().getByLabelText(/Thay phòng 102 bằng/), {
      target: { value: 'room-y' },
    })
    expect(confirm).toBeEnabled()
    fireEvent.click(confirm)

    await waitFor(() => expect(post).toHaveBeenCalledTimes(2))
    // The swap retry resends the chosen photo together with the replacement list.
    const retry = sentForm(post, 1)
    expect((retry.get('evidence') as File).name).toBe('cccd.jpg')
    expect(JSON.parse(retry.get('replacements') as string)).toEqual([
      { from: 'room-a2', to: 'room-y' },
    ])
  })

  it('explains when no replacement room is available', async () => {
    mockGet(options([]))
    vi.spyOn(api, 'post').mockRejectedValue(conflict('Rooms not ready: 102 (CLEANING)'))
    renderPage()
    await screen.findByRole('heading', { name: 'Khách đến (3)' })

    fireEvent.click(arrival().getByRole('button', { name: 'Check In' }))
    await confirmCheckIn()
    expect(await arrival().findByText(/Không có phòng thay thế phù hợp/)).toBeInTheDocument()
    expect(arrival().getByRole('button', { name: 'Đổi phòng và Check In' })).toBeDisabled()
  })

  it('shows other errors without the replacement panel', async () => {
    mockGet({
      bookingId: 'a2',
      code: 'ARC',
      rooms: [
        {
          id: 'room-a2',
          roomNumber: '102',
          roomTypeName: 'Deluxe',
          ready: true,
          status: 'AVAILABLE',
          replacements: [],
        },
      ],
    })
    vi.spyOn(api, 'post').mockRejectedValue(
      conflict('Too early to check in: arrival date is 2099-01-10'),
    )
    renderPage()
    await screen.findByRole('heading', { name: 'Khách đến (3)' })

    fireEvent.click(arrival().getByRole('button', { name: 'Check In' }))
    await confirmCheckIn()
    expect(await screen.findByRole('alert')).toHaveTextContent('Too early to check in')
    expect(
      arrival().queryByRole('button', { name: 'Đổi phòng và Check In' }),
    ).not.toBeInTheDocument()
  })
})
