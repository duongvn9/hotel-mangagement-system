import contract from '../../../../backend/src/modules/payments/schemas/payment-transaction.schema.ts?raw'
import { configure, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { api } from '@/lib/api-client'
import { ME, renderWithAuth } from '@/features/auth/test-utils'
import { UserMenu } from '@/features/auth/UserMenu'
import { reportRoutes } from './routes'
import type { RevenueReport } from './api'
import {
  defaultRevenuePeriod,
  METHOD_LABELS,
  PURPOSE_LABELS,
  PAYMENT_STATUS_LABELS,
  revenueLabel,
  revenueMoney,
  reportInputError,
} from './presentation'
const root = '/manager/reports/revenue'
const report: RevenueReport = {
  period: {
    from: '2026-10-01',
    to: '2026-10-03',
    timezone: 'Asia/Ho_Chi_Minh',
    granularity: 'day',
  },
  totals: {
    successCount: 2,
    successAmount: 1234567,
    refunds: null,
    refundsSupported: false,
    netAmount: null,
    failedCount: 3,
    cancelledCount: 4,
    pendingCount: 5,
    anomalies: { count: 0 },
  },
  byMethod: [
    { method: 'VNPAY', successCount: 1, successAmount: 234567 },
    { method: 'CASH', successCount: 1, successAmount: 1000000 },
  ],
  byPurpose: [
    { purpose: 'DEPOSIT', successCount: 1, successAmount: 234567 },
    { purpose: 'FINAL', successCount: 1, successAmount: 1000000 },
  ],
  series: [
    { bucket: '2026-10-01', successCount: 1, successAmount: 234567 },
    { bucket: '2026-10-02', successCount: 0, successAmount: 0 },
    { bucket: '2026-10-03', successCount: 1, successAmount: 1000000 },
  ],
  generatedAt: '2026-10-25T03:25:00Z',
}
function renderPage(path = root + '?from=2026-10-01&to=2026-10-03', role = 'MANAGER') {
  return renderWithAuth([...reportRoutes, { path: '/login', element: <p>Đăng nhập test</p> }], {
    path,
    auth: { me: { ...ME, role, permissions: ['report:view'] }, status: 'authenticated' },
  })
}
describe('UC56 presentation contract', () => {
  it('aligns method/purpose/status labels with actual backend enums', () => {
    for (const [name, labels] of Object.entries({
      PaymentMethod: METHOD_LABELS,
      PaymentPurpose: PURPOSE_LABELS,
      PaymentStatus: PAYMENT_STATUS_LABELS,
    })) {
      const block = contract.match(new RegExp(`enum ${name} \\{([\\s\\S]*?)\\}`))![1]
      expect(Object.keys(labels)).toEqual(
        [...block.matchAll(/=\s*'([^']+)'/g)].map((match) => match[1]),
      )
    }
  })
  it.each(['OTHER', 'toString', '__proto__'])('displays unknown label %s literally', (value) =>
    expect(revenueLabel(METHOD_LABELS, value)).toBe(value),
  )
  it('uses Vietnam midnight for current month defaults', () => {
    expect(defaultRevenuePeriod(new Date('2026-09-30T16:59:59Z'))).toEqual({
      from: '2026-09-01',
      to: '2026-09-30',
    })
    expect(defaultRevenuePeriod(new Date('2026-09-30T17:00:00Z'))).toEqual({
      from: '2026-10-01',
      to: '2026-10-01',
    })
    expect(revenueMoney(1234567)).toBe('1.234.567 ₫')
  })
  it('accepts 366 days and rejects 367 or impossible/reversed dates', () => {
    expect(reportInputError('01/01/2024', '31/12/2024')).toBe('')
    expect(reportInputError('01/01/2024', '01/01/2025')).toContain('366')
    expect(reportInputError('30/02/2026', '01/03/2026')).toContain('hợp lệ')
    expect(reportInputError('03/10/2026', '01/10/2026')).toContain('trước')
  })
})
describe('UC56 Manager revenue page', () => {
  beforeAll(() => configure({ asyncUtilTimeout: 5000 }))
  afterAll(() => configure({ asyncUtilTimeout: 1000 }))
  beforeEach(() => {
    vi.spyOn(api, 'get').mockResolvedValue({ data: report })
  })
  afterEach(() => vi.restoreAllMocks())
  it('renders cash receipts, unsupported refunds, excluded status counts and accessible tables/chart', async () => {
    renderPage()
    await screen.findByRole('table', { name: 'Theo phương thức' })
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByText('1.234.567 ₫')).toBeInTheDocument()
    expect(screen.getByText('Chưa hỗ trợ ghi nhận hoàn tiền')).toBeInTheDocument()
    expect(screen.queryByText('Thực thu ròng')).not.toBeInTheDocument()
    const excluded = screen.getByRole('region', { name: 'Không tính vào doanh thu' })
    expect(within(excluded).getByText('Thất bại: 3')).toBeInTheDocument()
    expect(within(excluded).getByText('Bị hủy: 4')).toBeInTheDocument()
    expect(within(excluded).getByText('Đang chờ: 5')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /Biểu đồ cột/ })).toBeInTheDocument()
    const table = screen.getByRole('table', { name: 'Dữ liệu thực thu theo thời gian' })
    expect(within(table).getAllByRole('row')).toHaveLength(4)
    expect(within(table).getByText('02/10/2026')).toBeInTheDocument()
    expect(screen.getByText(/Cập nhật lúc 10:25/)).toBeInTheDocument()
    for (const text of ['Xuất', 'Sửa', 'Đối soát'])
      expect(screen.queryByRole('button', { name: text })).not.toBeInTheDocument()
  })
  it('defaults inputs from Vietnam month to today and requests once on initial load', async () => {
    renderPage(root)
    await screen.findByRole('table', { name: 'Theo phương thức' })
    const dates = defaultRevenuePeriod()
    expect(screen.getByLabelText(/Từ ngày/)).toHaveValue(dates.from.split('-').reverse().join('/'))
    expect(api.get).toHaveBeenCalledWith('/reports/revenue', {
      params: { ...dates, granularity: 'day', method: undefined, purpose: undefined },
    })
  })
  it('waits for submit, sends all chosen filters and preserves URL and back navigation', async () => {
    const { router } = renderPage()
    await screen.findByRole('table', { name: 'Theo phương thức' })
    vi.mocked(api.get).mockClear()
    fireEvent.change(screen.getByLabelText(/Từ ngày/), { target: { value: '02/10/2026' } })
    fireEvent.change(screen.getByLabelText('Gộp theo'), { target: { value: 'month' } })
    fireEvent.change(screen.getByLabelText('Phương thức thanh toán'), { target: { value: 'CASH' } })
    fireEvent.change(screen.getByLabelText('Mục đích'), { target: { value: 'FINAL' } })
    expect(api.get).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Xem báo cáo' }))
    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith('/reports/revenue', {
        params: {
          from: '2026-10-02',
          to: '2026-10-03',
          granularity: 'month',
          method: 'CASH',
          purpose: 'FINAL',
        },
      }),
    )
    expect(router.state.location.search).toContain('method=CASH')
    expect(router.state.location.search).toContain('from=2026-10-02')
    await router.navigate(-1)
    await waitFor(() => expect(screen.getByLabelText(/Từ ngày/)).toHaveValue('01/10/2026'))
  })
  it.each([
    ['30/02/2026', '03/10/2026', 'hợp lệ'],
    ['03/10/2026', '01/10/2026', 'trước'],
    ['01/01/2024', '01/01/2025', '366'],
  ])('blocks invalid client period %s/%s', async (from, to, message) => {
    renderPage()
    await screen.findByRole('table', { name: 'Theo phương thức' })
    vi.mocked(api.get).mockClear()
    fireEvent.change(screen.getByLabelText(/Từ ngày/), { target: { value: from } })
    fireEvent.change(screen.getByLabelText(/Đến ngày/), { target: { value: to } })
    fireEvent.click(screen.getByRole('button', { name: 'Xem báo cáo' }))
    expect(api.get).not.toHaveBeenCalled()
    expect(screen.getAllByText(new RegExp(message)).length).toBeGreaterThan(0)
    expect(screen.getByLabelText(/Từ ngày/)).toHaveAttribute('aria-invalid', 'true')
  })
  it('shows anomaly warning and partial-month explanation', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: {
        ...report,
        period: { ...report.period, granularity: 'month' },
        totals: { ...report.totals, anomalies: { count: 7 } },
      },
    })
    renderPage()
    expect(
      await screen.findByText('Có 7 giao dịch dữ liệu không hợp lệ bị loại khỏi doanh thu'),
    ).toBeInTheDocument()
    expect(screen.getByText(/Tháng đầu và cuối/)).toBeInTheDocument()
  })
  it('renders supported refunds and net if a future contract supplies them', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: {
        ...report,
        totals: {
          ...report.totals,
          refundsSupported: true,
          refunds: { count: 1, amount: 100 },
          netAmount: 1234467,
        },
      },
    })
    renderPage()
    expect(await screen.findByText('Thực thu ròng')).toBeInTheDocument()
    expect(screen.getByText('1.234.467 ₫')).toBeInTheDocument()
    expect(screen.queryByText('Chưa hỗ trợ ghi nhận hoàn tiền')).not.toBeInTheDocument()
  })
  it('keeps filters visible while loading', () => {
    vi.mocked(api.get).mockImplementation(() => new Promise(() => {}))
    renderPage()
    expect(screen.getByText('Đang tải báo cáo…')).toBeInTheDocument()
    expect(screen.getByLabelText(/Từ ngày/)).toHaveValue('01/10/2026')
    expect(screen.getByRole('button', { name: 'Xem báo cáo' })).toBeDisabled()
  })
  it('shows backend 400 and retries without losing filters', async () => {
    vi.mocked(api.get)
      .mockRejectedValueOnce({
        isAxiosError: true,
        response: { status: 400, data: { message: 'Kỳ báo cáo không hợp lệ từ BE' } },
      })
      .mockResolvedValue({ data: report })
    renderPage()
    expect(await screen.findByText('Kỳ báo cáo không hợp lệ từ BE')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
    await screen.findByRole('table', { name: 'Theo phương thức' })
    expect(screen.getByLabelText(/Từ ngày/)).toHaveValue('01/10/2026')
  })
  it('refreshes the same submitted filters with the submit button', async () => {
    renderPage()
    await screen.findByRole('table', { name: 'Theo phương thức' })
    vi.mocked(api.get).mockClear()
    fireEvent.click(screen.getByRole('button', { name: 'Xem báo cáo' }))
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(1))
  })
  it('shows explicit empty report instead of tables full of zeros', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: {
        ...report,
        totals: {
          ...report.totals,
          successCount: 0,
          successAmount: 0,
          failedCount: 0,
          cancelledCount: 0,
          pendingCount: 0,
        },
      },
    })
    renderPage()
    expect(await screen.findByText('Không có giao dịch trong kỳ đã chọn')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.getByText('Chưa hỗ trợ ghi nhận hoàn tiền')).toBeInTheDocument()
  })
  it.each(['CUSTOMER', 'RECEPTIONIST', 'SERVICE_STAFF', 'OPERATIONS_STAFF'])(
    'blocks %s even with report:view',
    async (role) => {
      renderPage(undefined, role)
      expect(
        await screen.findByRole('heading', { name: 'Không có quyền truy cập' }),
      ).toBeInTheDocument()
      expect(api.get).not.toHaveBeenCalled()
    },
  )
  it('redirects anonymous users to login', async () => {
    renderWithAuth([...reportRoutes, { path: '/login', element: <p>Đăng nhập test</p> }], {
      path: root,
    })
    expect(await screen.findByText('Đăng nhập test')).toBeInTheDocument()
    expect(api.get).not.toHaveBeenCalled()
  })
  it('includes the Manager menu link', () => {
    renderWithAuth([{ path: '/', element: <UserMenu /> }], {
      auth: { me: ME, status: 'authenticated' },
    })
    expect(screen.getByRole('link', { name: 'Báo cáo doanh thu' })).toHaveAttribute('href', root)
  })
})
