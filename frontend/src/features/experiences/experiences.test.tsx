import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { ExperiencesPage } from './pages/ExperiencesPage'

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ExperiencesPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('ExperiencesPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders a primary h1 heading', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({ data: { items: [] } })
    renderPage()
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: /Trải nghiệm được sắp đặt quanh bạn/i,
      }),
    ).toBeInTheDocument()
  })

  it('renders service catalog items with names and formatted prices when catalog succeeds', async () => {
    vi.spyOn(api, 'get').mockImplementation(async (path: string) => {
      if (path === '/bookings/service-catalog') {
        return {
          data: {
            items: [
              {
                id: 's1',
                name: 'Đón sân bay Cam Ranh',
                unit: 'chuyến',
                billable: true,
                unitPriceVND: 350000,
              },
              {
                id: 's2',
                name: 'Trà chiều bên hồ',
                unit: 'set',
                billable: true,
                unitPriceVND: 220000,
              },
            ],
          },
        }
      }
      return { data: {} }
    })

    renderPage()

    expect(await screen.findByRole('heading', { name: 'Thực đơn dịch vụ' })).toBeInTheDocument()
    expect(screen.getByText('Đón sân bay Cam Ranh')).toBeInTheDocument()
    expect(screen.getByText('350.000 ₫')).toBeInTheDocument()
    expect(screen.getByText('Trà chiều bên hồ')).toBeInTheDocument()
    expect(screen.getByText('220.000 ₫')).toBeInTheDocument()
  })

  it('hides the service catalog section when catalog is empty or fails', async () => {
    vi.spyOn(api, 'get').mockRejectedValue(new Error('Network error'))
    renderPage()

    expect(screen.queryByRole('heading', { name: 'Thực đơn dịch vụ' })).not.toBeInTheDocument()
  })

  it('provides a CTA link to /search labeled Đặt phòng', () => {
    vi.spyOn(api, 'get').mockResolvedValue({ data: { items: [] } })
    renderPage()

    const cta = screen.getByRole('link', { name: /Đặt phòng/i })
    expect(cta).toHaveAttribute('href', '/search')
  })

  it('ensures every img element has a non-empty alt text', () => {
    vi.spyOn(api, 'get').mockResolvedValue({ data: { items: [] } })
    renderPage()

    const images = screen.getAllByRole('img')
    expect(images.length).toBeGreaterThan(0)
    for (const img of images) {
      expect(img).toHaveAttribute('alt')
      expect(img.getAttribute('alt')?.trim().length).toBeGreaterThan(0)
    }
  })
})
