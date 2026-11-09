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
  const put = vi
    .spyOn(api, 'put')
    .mockResolvedValue({ data: { ...CUSTOM, permissions: ['task:execute'] } })
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
    fireEvent.click(screen.getByRole('button', { name: 'Thêm vai trò' }))
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
    expect(within(form).queryByRole('switch')).toBeNull()
    expect(within(form).queryByLabelText(/Mã vai trò/)).toBeNull()
  })

  it('tick một ô trong ma trận lưu ngay cả danh sách mới', async () => {
    const { put } = setup()
    fireEvent.click(await screen.findByRole('checkbox', { name: 'HOUSEKEEPING task:execute' }))
    await waitFor(() =>
      expect(put).toHaveBeenCalledWith('/roles/r2/permissions', { permissions: ['task:execute'] }),
    )
    expect(await screen.findByText('Đã cập nhật quyền của Buồng phòng')).toBeInTheDocument()
  })

  it('báo lỗi khi lưu quyền thất bại', async () => {
    const { put } = setup()
    put.mockRejectedValue(new Error('Không lưu được'))
    fireEvent.click(await screen.findByRole('checkbox', { name: 'HOUSEKEEPING task:execute' }))
    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })

  it('khoá cột vai trò khi đang lưu quyền của vai trò đó', async () => {
    const { put } = setup()
    put.mockImplementation(() => new Promise(() => {}))
    fireEvent.click(await screen.findByRole('checkbox', { name: 'HOUSEKEEPING task:execute' }))
    await waitFor(() =>
      expect(screen.getByRole('checkbox', { name: 'HOUSEKEEPING role:manage' })).toBeDisabled(),
    )
    // Cột của vai trò khác vẫn bấm được.
    expect(screen.getByRole('checkbox', { name: 'MANAGER role:manage' })).toBeEnabled()
  })
})
