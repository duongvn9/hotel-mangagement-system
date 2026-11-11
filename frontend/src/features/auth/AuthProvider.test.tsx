import { act, render } from '@testing-library/react'
import { AxiosError, AxiosHeaders } from 'axios'
import { queryClient } from '@/app/query-client'
import { getMe, registerAccount } from './api'
import { useAuth, type AuthContextValue } from './auth-context'
import { AuthProvider } from './AuthProvider'

const firebase = vi.hoisted(() => ({
  user: {
    displayName: 'Nguyễn Văn A',
    email: 'a@gmail.com',
    getIdToken: vi.fn(() => Promise.resolve('google-token')),
  },
  signOut: vi.fn(() => Promise.resolve()),
}))

vi.mock('@/lib/firebase', () => ({ firebaseAuth: {} }))
vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: vi.fn(),
  signInWithPopup: vi.fn(() => Promise.resolve({ user: firebase.user })),
  onAuthStateChanged: vi.fn(() => () => undefined),
  signOut: firebase.signOut,
  createUserWithEmailAndPassword: vi.fn(),
  deleteUser: vi.fn(),
  sendEmailVerification: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
}))
vi.mock('./api', () => ({ getMe: vi.fn(), registerAccount: vi.fn() }))

const ME = {
  id: 'u1',
  email: 'a@gmail.com',
  fullName: 'Nguyễn Văn A',
  role: 'CUSTOMER',
  permissions: [],
}

function httpError(status: number, message: string) {
  return new AxiosError(message, String(status), undefined, undefined, {
    status,
    statusText: '',
    headers: {},
    config: { headers: new AxiosHeaders() },
    data: { message },
  })
}

function Probe({ onAuth }: { onAuth: (auth: AuthContextValue) => void }) {
  onAuth(useAuth())
  return null
}

function renderProvider() {
  const latest: { auth?: AuthContextValue } = {}
  render(
    <AuthProvider>
      <Probe onAuth={(auth) => (latest.auth = auth)} />
    </AuthProvider>,
  )
  return () => latest.auth!
}

describe('AuthProvider.loginWithGoogle', () => {
  beforeEach(() => vi.clearAllMocks())

  it('đăng nhập tài khoản HMS đã có mà không tạo tài khoản mới', async () => {
    vi.mocked(getMe).mockResolvedValue(ME)
    const auth = renderProvider()

    await act(() => auth().loginWithGoogle())

    expect(registerAccount).not.toHaveBeenCalled()
    expect(auth().me).toEqual(ME)
    expect(auth().status).toBe('authenticated')
  })

  it('clears manager booking cache when switching directly to a customer account', async () => {
    vi.mocked(getMe).mockResolvedValueOnce({ ...ME, id: 'manager', role: 'MANAGER' })
    const auth = renderProvider()
    await act(() => auth().loginWithGoogle())
    queryClient.setQueryData(['booking', 'manager-booking', null], { code: 'MANAGER-ONLY' })
    queryClient.setQueryData(['my-bookings'], [{ id: 'manager-booking' }])

    vi.mocked(getMe).mockResolvedValueOnce(ME)
    await act(() => auth().loginWithGoogle())

    expect(auth().me?.id).toBe('u1')
    expect(queryClient.getQueryData(['booking', 'manager-booking', null])).toBeUndefined()
    expect(queryClient.getQueryData(['my-bookings'])).toBeUndefined()
    queryClient.clear()
  })

  it('lần đầu đăng nhập Google thì tạo tài khoản Customer bằng tên Google', async () => {
    vi.mocked(getMe)
      .mockRejectedValueOnce(httpError(401, 'Tài khoản chưa đăng ký trong HMS'))
      .mockResolvedValue(ME)
    vi.mocked(registerAccount).mockResolvedValue({})
    const auth = renderProvider()

    await act(() => auth().loginWithGoogle())

    expect(registerAccount).toHaveBeenCalledWith('google-token', { fullName: 'Nguyễn Văn A' })
    expect(auth().me).toEqual(ME)
  })

  it('HMS từ chối (ví dụ tài khoản bị khoá) thì đăng xuất Firebase và báo lỗi', async () => {
    vi.mocked(getMe).mockRejectedValue(httpError(403, 'Tài khoản đã bị khoá'))
    const auth = renderProvider()

    await expect(act(() => auth().loginWithGoogle())).rejects.toThrow('Tài khoản đã bị khoá')

    expect(registerAccount).not.toHaveBeenCalled()
    expect(firebase.signOut).toHaveBeenCalled()
    expect(auth().me).toBeNull()
  })
})
