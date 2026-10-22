import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { api } from '@/lib/api-client'
import { ME, renderWithAuth } from '@/features/auth/test-utils'
import { AccountsPage } from './AccountsPage'

const STAFF = {
  id: 's1',
  email: 'letan@hms.local',
  fullName: 'Trần Thị Lễ Tân',
  role: 'RECEPTIONIST',
  isActive: true,
  emailVerified: true,
  hasFirebaseAccount: false,
}
const SELF = { ...STAFF, id: ME.id, email: ME.email, fullName: ME.fullName, role: 'MANAGER' }

function setup() {
  const get = vi
    .spyOn(api, 'get')
    .mockResolvedValue({ data: { items: [STAFF, SELF], total: 2, page: 1, limit: 20 } })
  const post = vi.spyOn(api, 'post').mockResolvedValue({ data: { ...STAFF, email: 'moi@hms.vn' } })
  const patch = vi.spyOn(api, 'patch').mockResolvedValue({ data: STAFF })
  renderWithAuth([{ path: '/', element: <AccountsPage /> }], {
    auth: { me: ME, status: 'authenticated' },
  })
  return { get, post, patch }
}

const type = (form: HTMLElement, label: RegExp, value: string) =>
  fireEvent.change(within(form).getByLabelText(label), { target: { value } })

describe('AccountsPage', () => {
  afterEach(() => vi.restoreAllMocks())

  it('hiển thị danh sách và lọc theo vai trò', async () => {
    const { get } = setup()
    expect(await screen.findByText('Trần Thị Lễ Tân')).toBeInTheDocument()
    fireEvent.change(screen.getAllByLabelText(/Vai trò/)[0], { target: { value: 'RECEPTIONIST' } })
    await waitFor(() =>
      expect(get).toHaveBeenLastCalledWith('/users', {
        params: { page: 1, limit: 20, role: 'RECEPTIONIST' },
      }),
    )
  })

  it('tạo tài khoản mới', async () => {
    const { post } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Thêm mới' }))
    const form = screen.getByRole('form', { name: 'Tạo tài khoản' })
    type(form, /Email/, 'moi@hms.vn')
    type(form, /Mật khẩu/, 'secret12')
    type(form, /Họ và tên/, 'Nhân Viên Mới')
    fireEvent.change(within(form).getByLabelText(/Vai trò/), { target: { value: 'SERVICE_STAFF' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Lưu' }))

    expect(await screen.findByText('Đã lưu tài khoản moi@hms.vn')).toBeInTheDocument()
    expect(post).toHaveBeenCalledWith('/users', {
      email: 'moi@hms.vn',
      password: 'secret12',
      fullName: 'Nhân Viên Mới',
      phone: undefined,
      role: 'SERVICE_STAFF',
    })
  })

  it('khoá tài khoản nhân viên; tài khoản của mình không đổi được vai trò', async () => {
    const { patch } = setup()
    fireEvent.click(await screen.findByRole('button', { name: `Sửa ${ME.email}` }))
    let form = screen.getByRole('form', { name: 'Sửa tài khoản' })
    expect(within(form).getByLabelText(/Vai trò/)).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: `Sửa ${STAFF.email}` }))
    form = screen.getByRole('form', { name: 'Sửa tài khoản' })
    fireEvent.click(within(form).getByRole('checkbox'))
    fireEvent.click(within(form).getByRole('button', { name: 'Lưu' }))

    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith('/users/s1', {
        fullName: STAFF.fullName,
        phone: undefined,
        role: 'RECEPTIONIST',
        isActive: false,
      }),
    )
  })
})
