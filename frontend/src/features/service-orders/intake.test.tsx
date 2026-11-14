import { fireEvent, screen, waitFor } from '@testing-library/react'
import { api } from '@/lib/api-client'
import { ME, renderWithAuth } from '@/features/auth/test-utils'
import { serviceOrderRoutes } from './routes'

vi.mock('@/lib/api-client', () => ({
  api: { get: vi.fn(), post: vi.fn() },
  getErrorMessage: (_error: unknown, fallback: string) => fallback,
}))
const booking = {
  id: 'a'.repeat(24),
  code: 'BK100',
  guestName: 'Khách tại quầy',
  status: 'CHECKED_IN',
  checkIn: '2026-11-01T10:00:00Z',
  checkOut: '2027-12-30T10:00:00Z',
  rooms: [{ id: 'c'.repeat(24), roomNumber: '101' }],
}
const catalog = {
  id: 'b'.repeat(24),
  name: 'Giặt ủi',
  unit: 'kg',
  billable: true,
  unitPriceVND: 26000,
  description: '',
}
beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(api.get).mockImplementation(async (url) => ({
    data: {
      items:
        url === '/service-orders/intake/contexts'
          ? [booking]
          : url === '/service-orders/intake/catalog'
            ? [catalog]
            : [{ id: 'd'.repeat(24), displayName: 'Mai', role: 'SERVICE_STAFF' }],
    },
  }))
})
function page(role = 'RECEPTIONIST') {
  return renderWithAuth(serviceOrderRoutes, {
    path:
      role === 'RECEPTIONIST' ? '/staff/service-orders/intake' : '/staff/service-history/intake',
    auth: { me: { ...ME, role }, status: 'authenticated' },
  })
}
async function fill() {
  fireEvent.change(await screen.findByLabelText('Đặt phòng'), { target: { value: booking.id } })
  fireEvent.change(screen.getByLabelText('Dịch vụ'), { target: { value: catalog.id } })
}
afterEach(() => vi.restoreAllMocks())
it('rejects a requested time exactly at checkout', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-11-01T00:00Z').getTime())
  page()
  await fill()
  const local = new Date(booking.checkOut)
  const time = `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, '0')}-${String(local.getDate()).padStart(2, '0')}T${String(local.getHours()).padStart(2, '0')}:${String(local.getMinutes()).padStart(2, '0')}`
  fireEvent.change(screen.getByLabelText('Thời gian yêu cầu'), { target: { value: time } })
  fireEvent.click(screen.getByRole('button', { name: 'Ghi nhận yêu cầu' }))
  fireEvent.submit(screen.getByRole('button', { name: 'Ghi nhận yêu cầu' }).closest('form')!)
  expect(await screen.findByRole('alert')).toHaveTextContent(/Thời gian/)
  expect(api.post).not.toHaveBeenCalled()
})
it('rejects actual completion exactly at checkout', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(new Date('2028-01-01T00:00Z').getTime())
  page('SERVICE_STAFF')
  await fill()
  fireEvent.change(screen.getByLabelText('Hình thức ghi nhận'), {
    target: { value: 'COMPLETED_ON_SITE' },
  })
  await screen.findByRole('option', { name: 'Mai' })
  fireEvent.change(screen.getByLabelText('Người thực hiện thực tế'), {
    target: { value: 'd'.repeat(24) },
  })
  const local = new Date(booking.checkOut)
  const time = `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, '0')}-${String(local.getDate()).padStart(2, '0')}T${String(local.getHours()).padStart(2, '0')}:${String(local.getMinutes()).padStart(2, '0')}`
  fireEvent.change(screen.getByLabelText('Thời điểm hoàn thành thực tế'), {
    target: { value: time },
  })
  fireEvent.change(screen.getByLabelText('Kết quả thực hiện'), { target: { value: 'Đã giao' } })
  fireEvent.click(screen.getByRole('button', { name: 'Ghi nhận yêu cầu' }))
  fireEvent.submit(screen.getByRole('button', { name: 'Ghi nhận yêu cầu' }).closest('form')!)
  expect(await screen.findByRole('alert')).toHaveTextContent(/Chọn người thực hiện/)
  expect(api.post).not.toHaveBeenCalled()
})
it.each([
  [400, 'requestedTime must be future and within stay'],
  [400, 'Invalid integer VND amount'],
  [409, 'Service is not available for ordering'],
])('allows explicit safe correction for pre-persistence %s: %s', async (status, message) => {
  vi.mocked(api.post).mockRejectedValue({
    isAxiosError: true,
    response: { status, data: { message } },
  })
  page()
  await fill()
  fireEvent.click(screen.getByRole('button', { name: 'Ghi nhận yêu cầu' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Sửa yêu cầu chưa được tạo' }))
  expect(screen.getByLabelText('Ghi chú')).toBeEnabled()
  fireEvent.change(screen.getByLabelText('Ghi chú'), { target: { value: 'Đã sửa' } })
  fireEvent.click(screen.getByRole('button', { name: 'Ghi nhận yêu cầu' }))
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2))
  const calls = vi.mocked(api.post).mock.calls
  expect(calls[1][1]).toMatchObject({ notes: 'Đã sửa' })
  expect((calls[1][1] as { requestId: string }).requestId).not.toBe(
    (calls[0][1] as { requestId: string }).requestId,
  )
})
it.each([
  [404, 'Booking not found'],
  [404, 'Service order not found'],
  [400, 'Invoice cannot be updated'],
  [409, 'Review conflict'],
])('keeps potentially persisted %s %s locked', async (status, message) => {
  vi.mocked(api.post).mockRejectedValue({
    isAxiosError: true,
    response: { status, data: { message } },
  })
  page()
  await fill()
  fireEvent.click(screen.getByRole('button', { name: 'Ghi nhận yêu cầu' }))
  await screen.findByRole('alert')
  expect(
    screen.queryByRole('button', { name: 'Sửa yêu cầu chưa được tạo' }),
  ).not.toBeInTheDocument()
  expect(screen.getByLabelText('Ghi chú')).toBeDisabled()
  expect(screen.getByText(/Yêu cầu có thể đã được tạo/)).toBeInTheDocument()
})
it.each(['CUSTOMER', 'MANAGER', 'OPERATIONS_STAFF'])(
  'denies %s intake without fetching choices',
  async (role) => {
    renderWithAuth(serviceOrderRoutes, {
      path: '/staff/service-history/intake',
      auth: { me: { ...ME, role }, status: 'authenticated' },
    })
    expect(screen.queryByLabelText('Đặt phòng')).not.toBeInTheDocument()
    expect(api.get).not.toHaveBeenCalled()
  },
)
it('validates requested time against the selected stay before posting', async () => {
  page()
  await fill()
  fireEvent.change(screen.getByLabelText('Thời gian yêu cầu'), {
    target: { value: '2028-01-01T12:00' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Ghi nhận yêu cầu' }))
  fireEvent.submit(screen.getByRole('button', { name: 'Ghi nhận yêu cầu' }).closest('form')!)
  expect(await screen.findByRole('alert')).toHaveTextContent(/Thời gian/)
  expect(api.post).not.toHaveBeenCalled()
})
it('requires completion details and strips completion fields after switching back to unperformed', async () => {
  vi.mocked(api.post).mockRejectedValue(new Error('Mạng lỗi'))
  page('SERVICE_STAFF')
  await fill()
  fireEvent.change(screen.getByLabelText('Hình thức ghi nhận'), {
    target: { value: 'COMPLETED_ON_SITE' },
  })
  await screen.findByRole('option', { name: 'Mai' })
  fireEvent.submit(screen.getByRole('button', { name: 'Ghi nhận yêu cầu' }).closest('form')!)
  expect(await screen.findByRole('alert')).toHaveTextContent(/Chọn người thực hiện/)
  expect(api.post).not.toHaveBeenCalled()
  fireEvent.change(screen.getByLabelText('Hình thức ghi nhận'), {
    target: { value: 'UNPERFORMED' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Ghi nhận yêu cầu' }))
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1))
  const body = vi.mocked(api.post).mock.calls[0][1]
  expect(body).not.toHaveProperty('actualPerformerId')
  expect(body).not.toHaveProperty('actualCompletedAt')
  expect(body).not.toHaveProperty('completionDetails')
})
it('keeps the identical UUID and payload on uncertain intake failure without claiming acceptance', async () => {
  vi.mocked(api.post).mockRejectedValue(new Error('Chưa hoàn tất'))
  page()
  await fill()
  expect(screen.getAllByText(/Khách tại quầy/).length).toBeGreaterThan(0)
  expect(screen.queryByLabelText('Hình thức ghi nhận')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Ghi nhận yêu cầu' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Thử lại cùng nội dung' }))
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2))
  const bodies = vi.mocked(api.post).mock.calls.map((call) => call[1])
  expect(bodies[0]).toEqual(bodies[1])
  expect(bodies[0]).toMatchObject({
    bookingId: booking.id,
    serviceId: catalog.id,
    quantity: 1,
    intakeMode: 'UNPERFORMED',
    requestId: expect.stringMatching(/^[0-9a-f-]{36}$/),
  })
  expect(screen.queryByText('Đã chấp nhận')).not.toBeInTheDocument()
})
it('hides and omits a previous schedule for onsite intake and retries identical evidence', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-11-14T12:00Z').getTime())
  vi.mocked(api.post).mockRejectedValue(new Error('Unknown outcome'))
  page('SERVICE_STAFF')
  await fill()
  fireEvent.change(screen.getByLabelText('Thời gian yêu cầu'), {
    target: { value: '2028-01-01T12:00' },
  })
  fireEvent.change(screen.getByLabelText('Hình thức ghi nhận'), {
    target: { value: 'COMPLETED_ON_SITE' },
  })
  expect(screen.queryByLabelText('Thời gian yêu cầu')).not.toBeInTheDocument()
  await screen.findByRole('option', { name: 'Mai' })
  fireEvent.change(screen.getByLabelText('Người thực hiện thực tế'), {
    target: { value: 'd'.repeat(24) },
  })
  fireEvent.change(screen.getByLabelText('Thời điểm hoàn thành thực tế'), {
    target: { value: '2026-11-02T12:00' },
  })
  fireEvent.change(screen.getByLabelText('Kết quả thực hiện'), { target: { value: 'Đã giao' } })
  fireEvent.click(screen.getByRole('button', { name: 'Ghi nhận yêu cầu' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Thử lại cùng nội dung' }))
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2))
  expect(vi.mocked(api.post).mock.calls[0][1]).not.toHaveProperty('requestedTime')
  expect(vi.mocked(api.post).mock.calls[0][1]).toEqual(vi.mocked(api.post).mock.calls[1][1])
})

it('explains local to UTC conversion and bounds completion by the selected stay and now', async () => {
  const now = new Date('2026-11-14T12:00Z').getTime()
  vi.spyOn(Date, 'now').mockReturnValue(now)
  const local = (value: string | number) => {
    const date = new Date(value)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  }
  page('SERVICE_STAFF')
  await fill()
  expect(screen.getByLabelText('Thời gian yêu cầu')).toHaveAttribute('min', local(now + 60000))
  expect(screen.getByLabelText('Thời gian yêu cầu')).toHaveAttribute(
    'max',
    local(new Date(booking.checkOut).getTime() - 60000),
  )
  expect(screen.getByText(/giờ địa phương.*UTC/)).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Hình thức ghi nhận'), {
    target: { value: 'COMPLETED_ON_SITE' },
  })
  expect(screen.getByLabelText('Thời điểm hoàn thành thực tế')).toHaveAttribute(
    'min',
    local(booking.checkIn),
  )
  expect(screen.getByLabelText('Thời điểm hoàn thành thực tế')).toHaveAttribute('max', local(now))
  fireEvent.change(screen.getByLabelText('Hình thức ghi nhận'), {
    target: { value: 'UNPERFORMED' },
  })
  expect(screen.getByLabelText('Thời gian yêu cầu')).toBeInTheDocument()
})

it('requires actual completion evidence for staff completed-on-site intake', async () => {
  vi.mocked(api.post).mockResolvedValue({
    data: { id: 'report-1', reviewStatus: 'PENDING_REVIEW', executionStatus: 'NOT_STARTED' },
  })
  page('SERVICE_STAFF')
  await fill()
  fireEvent.change(screen.getByLabelText('Hình thức ghi nhận'), {
    target: { value: 'COMPLETED_ON_SITE' },
  })
  await screen.findByRole('option', { name: 'Mai' })
  fireEvent.change(screen.getByLabelText('Người thực hiện thực tế'), {
    target: { value: 'd'.repeat(24) },
  })
  fireEvent.change(screen.getByLabelText('Thời điểm hoàn thành thực tế'), {
    target: { value: '2026-11-01T20:00' },
  })
  fireEvent.change(screen.getByLabelText('Kết quả thực hiện'), {
    target: { value: 'Đã giao đồ sạch' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Ghi nhận yêu cầu' }))
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1))
  expect(vi.mocked(api.post).mock.calls[0][1]).toMatchObject({
    intakeMode: 'COMPLETED_ON_SITE',
    actualPerformerId: 'd'.repeat(24),
    completionDetails: 'Đã giao đồ sạch',
    actualCompletedAt: new Date('2026-11-01T20:00').toISOString(),
  })
  expect(await screen.findByText(/Đã ghi nhận, chờ lễ tân duyệt/)).toBeInTheDocument()
})
