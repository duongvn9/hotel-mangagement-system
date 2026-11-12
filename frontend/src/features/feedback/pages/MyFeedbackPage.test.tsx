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

const conflict = (message: string) => ({
  isAxiosError: true,
  response: { status: 409, data: { message } },
})

const panel = (name: string) =>
  within(screen.getByRole('heading', { name }).closest('section') as HTMLElement)

describe('MyFeedbackPage', () => {
  it('blocks roles other than customers', () => {
    renderPage({ ...customer, role: 'RECEPTIONIST' })
    expect(screen.getByText('Không có quyền truy cập')).toBeInTheDocument()
  })

  it('lays out the write panel next to the reviews already sent, like the prototype', async () => {
    const get = vi.spyOn(api, 'get').mockResolvedValue({ data: stays() })
    renderPage()

    expect(await screen.findByRole('heading', { level: 1, name: 'Đánh giá' })).toBeInTheDocument()
    expect(
      screen.getByText('Hãy kể về kỳ nghỉ của bạn — ban quản lý đọc mọi đánh giá.'),
    ).toBeInTheDocument()
    expect(get).toHaveBeenCalledWith('/feedback/mine')
    expect(screen.getByRole('heading', { name: 'Viết đánh giá' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Đánh giá của tôi' })).toBeInTheDocument()
  })

  it('offers only the stays that have no review yet', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({ data: stays() })
    renderPage()

    const select = await screen.findByLabelText('Kỳ lưu trú')
    const options = within(select as HTMLElement)
      .getAllByRole('option')
      .map((option) => option.textContent)
    expect(options).toEqual(['Chọn kỳ lưu trú đã hoàn thành', expect.stringContaining('BKNEW')])
  })

  it('lists the reviews sent, with stars, code and date, and the hotel’s reply', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({ data: stays() })
    renderPage()
    await screen.findByLabelText('Kỳ lưu trú')

    const mine = panel('Đánh giá của tôi')
    expect(mine.getByText('Tuyệt vời')).toBeInTheDocument()
    expect(mine.getByRole('img', { name: '5 trên 5 sao' })).toBeInTheDocument()
    expect(mine.getByText(/BKREPLIED/)).toBeInTheDocument()
    expect(mine.getByText('Khách sạn phản hồi:')).toBeInTheDocument()
    expect(mine.getByText('Cảm ơn anh/chị')).toBeInTheDocument()

    // Đánh giá không có sao: không hiện sao; chưa có phản hồi thì không có khung phản hồi.
    expect(mine.getByText('Ổn')).toBeInTheDocument()
    expect(mine.getAllByRole('img')).toHaveLength(1)
    expect(mine.getAllByText('Khách sạn phản hồi:')).toHaveLength(1)
  })

  it('sends the chosen stay, the stars and the trimmed content, then reloads', async () => {
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

    fireEvent.change(await screen.findByLabelText('Kỳ lưu trú'), { target: { value: 'b1' } })
    fireEvent.click(screen.getByRole('button', { name: '4 stars' }))
    fireEvent.change(screen.getByPlaceholderText('Điều gì ấn tượng? Điều gì cần cải thiện?'), {
      target: { value: '  Phòng sạch  ' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Gửi đánh giá' }))

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/feedback', {
        bookingId: 'b1',
        rating: 4,
        content: 'Phòng sạch',
      }),
    )
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2))
    // Lần lưu trú đã đánh giá chuyển sang "Đánh giá của tôi"; không còn gì để đánh giá.
    expect(await panel('Đánh giá của tôi').findByText('Phòng sạch')).toBeInTheDocument()
    expect(await screen.findByText('Chưa có gì để đánh giá')).toBeInTheDocument()
  })

  it('does not need stars, and a second click on the same star clears it', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({ data: stays() })
    const post = vi.spyOn(api, 'post').mockResolvedValue({ data: { id: 'f1' } })
    renderPage()

    fireEvent.change(await screen.findByLabelText('Kỳ lưu trú'), { target: { value: 'b1' } })
    fireEvent.click(screen.getByRole('button', { name: '3 stars' }))
    fireEvent.click(screen.getByRole('button', { name: '3 stars' }))
    fireEvent.change(screen.getByPlaceholderText('Điều gì ấn tượng? Điều gì cần cải thiện?'), {
      target: { value: 'Không sao' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Gửi đánh giá' }))

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/feedback', { bookingId: 'b1', content: 'Không sao' }),
    )
  })

  it('needs a stay and some content before it can be sent', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({ data: stays() })
    const post = vi.spyOn(api, 'post')
    renderPage()
    const send = await screen.findByRole('button', { name: 'Gửi đánh giá' })
    const comment = screen.getByPlaceholderText('Điều gì ấn tượng? Điều gì cần cải thiện?')

    expect(send).toBeDisabled()
    fireEvent.change(comment, { target: { value: 'Tốt' } })
    expect(send).toBeDisabled() // chưa chọn kỳ lưu trú
    fireEvent.change(screen.getByLabelText('Kỳ lưu trú'), { target: { value: 'b1' } })
    expect(send).toBeEnabled()
    fireEvent.change(comment, { target: { value: '   ' } })
    expect(send).toBeDisabled()
    expect(post).not.toHaveBeenCalled()
  })

  it('shows the server error and keeps what was typed', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({ data: stays() })
    vi.spyOn(api, 'post').mockRejectedValue(
      conflict('Feedback for this stay has already been sent'),
    )
    renderPage()

    fireEvent.change(await screen.findByLabelText('Kỳ lưu trú'), { target: { value: 'b1' } })
    const comment = screen.getByPlaceholderText('Điều gì ấn tượng? Điều gì cần cải thiện?')
    fireEvent.change(comment, { target: { value: 'Tốt' } })
    fireEvent.click(screen.getByRole('button', { name: 'Gửi đánh giá' }))

    expect(await panel('Viết đánh giá').findByRole('alert')).toHaveTextContent('already been sent')
    expect(comment).toHaveValue('Tốt')
  })

  it('shows the empty states when there is nothing to review and no review yet', async () => {
    vi.spyOn(api, 'get').mockResolvedValueOnce({ data: { items: [] } })
    renderPage()

    expect(await screen.findByText('Chưa có gì để đánh giá')).toBeInTheDocument()
    expect(
      screen.getByText('Sau khi trả phòng, bạn có thể đánh giá kỳ nghỉ tại đây.'),
    ).toBeInTheDocument()
    expect(screen.getByText('Bạn chưa có đánh giá nào.')).toBeInTheDocument()
  })

  it('shows an error state when the stays cannot be loaded', async () => {
    vi.spyOn(api, 'get').mockRejectedValue({
      isAxiosError: true,
      response: { status: 500, data: { message: 'Boom' } },
    })
    renderPage()
    expect(await screen.findByRole('alert')).toHaveTextContent('Boom')
  })
})
