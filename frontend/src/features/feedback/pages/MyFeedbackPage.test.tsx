import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { api } from '@/lib/api-client'
import { ME, renderWithAuth } from '@/features/auth/test-utils'
import { feedbackRoutes } from '../routes'
import type { MyStaysResponse } from '../api'

const customer = { ...ME, id: 'c1', email: 'customer@hms.local', role: 'CUSTOMER' }

const stays = (): MyStaysResponse => ({
  items: [
    {
      bookingId: 'b1',
      code: 'BKNEW',
      checkIn: '2099-01-09T17:00:00.000Z',
      checkOut: '2099-01-11T17:00:00.000Z',
      feedback: null,
    },
    {
      bookingId: 'b2',
      code: 'BKREPLIED',
      checkIn: '2098-12-09T17:00:00.000Z',
      checkOut: '2098-12-11T17:00:00.000Z',
      feedback: {
        id: 'f2',
        rating: 5,
        content: 'Tuyệt vời',
        createdAt: '2098-12-12T03:00:00.000Z',
        reply: { content: 'Cảm ơn anh/chị', repliedAt: '2098-12-13T03:00:00.000Z' },
      },
    },
    {
      bookingId: 'b3',
      code: 'BKSENT',
      checkIn: '2098-11-09T17:00:00.000Z',
      checkOut: '2098-11-11T17:00:00.000Z',
      feedback: {
        id: 'f3',
        content: 'Ổn',
        createdAt: '2098-11-12T03:00:00.000Z',
      },
    },
  ],
})

function renderPage(role = customer) {
  return renderWithAuth(feedbackRoutes, {
    path: '/my-feedback',
    auth: { me: role, status: 'authenticated' },
  })
}

const stay = (code: string) => within(screen.getByRole('article', { name: code }))

const conflict = (message: string) => ({
  isAxiosError: true,
  response: { status: 409, data: { message } },
})

describe('MyFeedbackPage', () => {
  it('blocks roles other than customers', () => {
    renderPage({ ...customer, role: 'RECEPTIONIST' })
    expect(screen.getByText('Không có quyền truy cập')).toBeInTheDocument()
  })

  it('lists completed stays with a form, or the feedback already sent and its reply', async () => {
    const get = vi.spyOn(api, 'get').mockResolvedValue({ data: stays() })
    renderPage()

    expect(await screen.findByRole('article', { name: 'BKNEW' })).toBeInTheDocument()
    expect(get).toHaveBeenCalledWith('/feedback/mine')
    expect(stay('BKNEW').getByRole('button', { name: 'Gửi phản hồi' })).toBeInTheDocument()

    const replied = stay('BKREPLIED')
    expect(replied.getByText('Tuyệt vời')).toBeInTheDocument()
    expect(replied.getByRole('img', { name: '5 trên 5 sao' })).toBeInTheDocument()
    expect(replied.getByText('Cảm ơn anh/chị')).toBeInTheDocument()
    expect(replied.queryByRole('button', { name: 'Gửi phản hồi' })).not.toBeInTheDocument()

    const sent = stay('BKSENT')
    expect(sent.getByText('Ổn')).toBeInTheDocument()
    expect(sent.queryByRole('img')).not.toBeInTheDocument()
    expect(sent.getByText('Chưa có câu trả lời.')).toBeInTheDocument()
    expect(sent.queryByRole('button', { name: 'Gửi phản hồi' })).not.toBeInTheDocument()
  })

  it('sends the rating and trimmed content, then reloads the stays', async () => {
    const reloaded = stays()
    reloaded.items[0]!.feedback = {
      id: 'f1',
      rating: 4,
      content: 'Phòng sạch',
      createdAt: '2099-01-12T03:00:00.000Z',
    }
    const get = vi
      .spyOn(api, 'get')
      .mockResolvedValueOnce({ data: stays() })
      .mockResolvedValue({ data: reloaded })
    const post = vi.spyOn(api, 'post').mockResolvedValue({ data: { id: 'f1' } })
    renderPage()
    await screen.findByRole('article', { name: 'BKNEW' })

    fireEvent.change(stay('BKNEW').getByLabelText(/Đánh giá/), { target: { value: '4' } })
    fireEvent.change(stay('BKNEW').getByLabelText(/Nội dung/), {
      target: { value: '  Phòng sạch  ' },
    })
    fireEvent.click(stay('BKNEW').getByRole('button', { name: 'Gửi phản hồi' }))

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/feedback', {
        bookingId: 'b1',
        rating: 4,
        content: 'Phòng sạch',
      }),
    )
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2))
    expect(
      await within(screen.getByRole('article', { name: 'BKNEW' })).findByText('Phòng sạch'),
    ).toBeInTheDocument()
    expect(
      within(screen.getByRole('article', { name: 'BKNEW' })).queryByRole('button', {
        name: 'Gửi phản hồi',
      }),
    ).not.toBeInTheDocument()
  })

  it('does not need a rating', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({ data: stays() })
    const post = vi.spyOn(api, 'post').mockResolvedValue({ data: { id: 'f1' } })
    renderPage()
    await screen.findByRole('article', { name: 'BKNEW' })

    fireEvent.change(stay('BKNEW').getByLabelText(/Nội dung/), { target: { value: 'Không sao' } })
    fireEvent.click(stay('BKNEW').getByRole('button', { name: 'Gửi phản hồi' }))
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/feedback', { bookingId: 'b1', content: 'Không sao' }),
    )
  })

  it('needs some content and shows how much is left', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({ data: stays() })
    const post = vi.spyOn(api, 'post')
    renderPage()
    await screen.findByRole('article', { name: 'BKNEW' })
    const send = stay('BKNEW').getByRole('button', { name: 'Gửi phản hồi' })

    expect(send).toBeDisabled()
    expect(stay('BKNEW').getByText('0/2000')).toBeInTheDocument()
    fireEvent.change(stay('BKNEW').getByLabelText(/Nội dung/), { target: { value: '   ' } })
    expect(send).toBeDisabled()
    fireEvent.change(stay('BKNEW').getByLabelText(/Nội dung/), { target: { value: 'abc' } })
    expect(send).toBeEnabled()
    expect(stay('BKNEW').getByText('3/2000')).toBeInTheDocument()
    expect(post).not.toHaveBeenCalled()
  })

  it('shows the server error and keeps what was typed', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({ data: stays() })
    vi.spyOn(api, 'post').mockRejectedValue(
      conflict('Feedback for this stay has already been sent'),
    )
    renderPage()
    await screen.findByRole('article', { name: 'BKNEW' })

    fireEvent.change(stay('BKNEW').getByLabelText(/Nội dung/), { target: { value: 'Tốt' } })
    fireEvent.click(stay('BKNEW').getByRole('button', { name: 'Gửi phản hồi' }))
    expect(await stay('BKNEW').findByRole('alert')).toHaveTextContent('already been sent')
    expect(stay('BKNEW').getByLabelText(/Nội dung/)).toHaveValue('Tốt')
  })

  it('shows an empty state and an error state', async () => {
    vi.spyOn(api, 'get').mockResolvedValueOnce({ data: { items: [] } })
    const empty = renderPage()
    expect(await screen.findByText('Chưa có lần lưu trú nào để phản hồi.')).toBeInTheDocument()
    empty.unmount()

    vi.spyOn(api, 'get').mockRejectedValue({
      isAxiosError: true,
      response: { status: 500, data: { message: 'Boom' } },
    })
    renderPage()
    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })
})
