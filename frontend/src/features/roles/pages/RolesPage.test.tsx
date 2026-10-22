import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { api } from '@/lib/api-client'
import { ME, renderWithAuth } from '@/features/auth/test-utils'
import { RolesPage } from './RolesPage'

const MANAGER_ROLE = {
  id: 'r1',
  code: 'MANAGER',
  name: 'Quản lý',
  isSystem: true,
  isActive: true,
  permissions: ['role:manage'],
  userCount: 1,
}
const CUSTOM = {
  id: 'r2',
  code: 'HOUSEKEEPING',
  name: 'Buồng phòng',
  isSystem: false,
  isActive: true,
  permissions: [],
  userCount: 0,
}
const PERMISSIONS = [
  { code: 'role:manage', description: 'Quản lý role' },
  { code: 'task:execute', description: 'Làm công việc được giao' },
]

function setup() {
  vi.spyOn(api, 'get').mockImplementation(async (url: string) => ({
    data: url === '/roles' ? [MANAGER_ROLE, CUSTOM] : PERMISSIONS,
  }))
  const post = vi.spyOn(api, 'post').mockResolvedValue({ data: { ...CUSTOM, code: 'NEW_ROLE' } })
  const patch = vi.spyOn(api, 'patch').mockResolvedValue({ data: CUSTOM })
  const put = vi.spyOn(api, 'put').mockResolvedValue({ data: CUSTOM })
  renderWithAuth([{ path: '/', element: <RolesPage /> }], {
    auth: { me: ME, status: 'authenticated' },
  })
  return { post, patch, put }
}

describe('RolesPage', () => {
  afterEach(() => vi.restoreAllMocks())

  it('tạo vai trò, mã tự viết hoa', async () => {
    const { post } = setup()
    await screen.findByText('Buồng phòng')
    fireEvent.click(screen.getByRole('button', { name: 'Thêm mới' }))
    const form = screen.getByRole('form', { name: 'Tạo vai trò' })
    fireEvent.change(within(form).getByLabelText(/Mã vai trò/), { target: { value: 'new_role' } })
    fireEvent.change(within(form).getByLabelText(/Tên vai trò/), { target: { value: 'Mới' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Lưu' }))

    expect(await screen.findByText('Đã lưu vai trò NEW_ROLE')).toBeInTheDocument()
    expect(post).toHaveBeenCalledWith('/roles', {
      code: 'NEW_ROLE',
      name: 'Mới',
      description: undefined,
    })
  })

  it('role hệ thống không có ô ngừng dùng', async () => {
    setup()
    fireEvent.click(await screen.findByRole('button', { name: 'Sửa MANAGER' }))
    const form = screen.getByRole('form', { name: 'Sửa vai trò' })
    expect(within(form).queryByRole('checkbox')).toBeNull()
    expect(within(form).queryByLabelText(/Mã vai trò/)).toBeNull()
  })

  it('gán quyền cho vai trò', async () => {
    const { put } = setup()
    fireEvent.click(await screen.findByRole('button', { name: 'Phân quyền HOUSEKEEPING' }))
    const panel = await screen.findByRole('region', { name: 'Phân quyền HOUSEKEEPING' })
    fireEvent.click(within(panel).getByLabelText(/Làm công việc được giao/))
    fireEvent.click(within(panel).getByRole('button', { name: 'Lưu phân quyền' }))

    await waitFor(() =>
      expect(put).toHaveBeenCalledWith('/roles/r2/permissions', { permissions: ['task:execute'] }),
    )
  })
})
