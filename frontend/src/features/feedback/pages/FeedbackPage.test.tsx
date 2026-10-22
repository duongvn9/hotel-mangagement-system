import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { api } from '@/lib/api-client'
import { ME, renderWithAuth } from '@/features/auth/test-utils'
import { FeedbackPage } from './FeedbackPage'

const UNREPLIED = {
  id: 'f1',
  bookingId: 'b1',
  rating: 2,
  content: 'Wifi yếu quá',
  createdAt: '2026-10-20T03:00:00Z',
  customer: { id: 'c1', fullName: 'Nguyễn Văn Khách', email: 'customer@hms.local' },
}
const REPLIED = {
  ...UNREPLIED,
  id: 'f2',
  rating: 5,
  content: 'Tuyệt vời',
  reply: {
    content: 'Cảm ơn anh',
    repliedAt: '2026-10-21T03:00:00Z',
    repliedBy: { id: 'r1', fullName: 'Trần Thị Lễ Tân' },
  },
}

function setup(role: string) {
  const get = vi
    .spyOn(api, 'get')
    .mockResolvedValue({ data: { items: [UNREPLIED, REPLIED], total: 2, page: 1, limit: 10 } })
  const post = vi.spyOn(api, 'post').mockResolvedValue({ data: UNREPLIED })
  renderWithAuth([{ path: '/', element: <FeedbackPage /> }], {
    auth: { me: { ...ME, role }, status: 'authenticated' },
  })
  return { get, post }
}

describe('FeedbackPage', () => {
  afterEach(() => vi.restoreAllMocks())

  it('Lễ tân trả lời phản hồi chưa trả lời', async () => {
    const { post } = setup('RECEPTIONIST')
    const cards = await screen.findAllByRole('article')
    const first = cards[0]
    expect(within(first).getByRole('img', { name: '2 trên 5 sao' })).toBeInTheDocument()
    fireEvent.click(within(first).getByRole('button', { name: 'Trả lời' }))
    fireEvent.change(within(first).getByLabelText(/Nội dung trả lời/), {
      target: { value: '  Đã nâng cấp wifi  ' },
    })
    fireEvent.click(within(first).getByRole('button', { name: 'Gửi trả lời' }))

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/feedback/f1/reply', { content: 'Đã nâng cấp wifi' }),
    )
    expect(within(cards[1]).getByText('Cảm ơn anh')).toBeInTheDocument()
    expect(within(cards[1]).queryByRole('button', { name: 'Trả lời' })).toBeNull()
  })

  it('Manager chỉ xem, không có nút trả lời; lọc chưa trả lời', async () => {
    const { get } = setup('MANAGER')
    await screen.findAllByRole('article')
    expect(screen.queryByRole('button', { name: 'Trả lời' })).toBeNull()

    fireEvent.change(screen.getByLabelText(/Trạng thái/), { target: { value: 'false' } })
    await waitFor(() =>
      expect(get).toHaveBeenLastCalledWith('/feedback', {
        params: { page: 1, limit: 10, replied: 'false' },
      }),
    )
  })
})
