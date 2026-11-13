import { QueryClientProvider, useQuery } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { AxiosError, AxiosHeaders } from 'axios'
import { onAuthStateChanged, type User } from 'firebase/auth'
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

describe('AuthProvider public search cache during session restoration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    queryClient.clear()
  })

  afterEach(() => queryClient.clear())

  it.each(['authenticated', 'anonymous'])(
    'does not refetch public search queries on quantity changes after restoring an %s session',
    async (session) => {
      let restoreUser!: () => void
      vi.mocked(onAuthStateChanged).mockImplementationOnce((_auth, callback) => {
        restoreUser = () => {
          if (typeof callback === 'function') {
            callback(session === 'authenticated' ? (firebase.user as unknown as User) : null)
          }
        }
        return () => undefined
      })
      let resolveMe!: (me: typeof ME) => void
      if (session === 'authenticated') {
        vi.mocked(getMe).mockReturnValueOnce(
          new Promise((resolve) => {
            resolveMe = resolve
          }),
        )
      }
      const fetchFilters = vi.fn().mockResolvedValue({ bedTypes: [] })
      const fetchAvailability = vi.fn().mockResolvedValue([{ id: 'room' }])
      const availabilityKey = [
        'availability',
        { checkIn: '2026-12-01', checkOut: '2026-12-02', guests: 2 },
      ]
      function SearchProbe() {
        const [quantity, setQuantity] = useState(0)
        const filters = useQuery({
          queryKey: ['search-filters'],
          queryFn: fetchFilters,
          staleTime: 5 * 60 * 1000,
        })
        const availability = useQuery({
          queryKey: availabilityKey,
          queryFn: fetchAvailability,
        })
        return (
          <button
            onClick={() => setQuantity((previous) => previous + 1)}
            disabled={!filters.data || !availability.data}
          >
            Quantity {quantity}
          </button>
        )
      }
      render(
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <SearchProbe />
          </AuthProvider>
        </QueryClientProvider>,
      )
      await waitFor(() => expect(screen.getByRole('button')).toBeEnabled())
      expect(fetchFilters).toHaveBeenCalledTimes(1)
      expect(fetchAvailability).toHaveBeenCalledTimes(1)
      // Even an initial restoration must discard potentially sensitive cached data.
      queryClient.setQueryData(['booking', 'old-private-booking', null], { code: 'PRIVATE' })
      if (session === 'authenticated') {
        act(() => restoreUser())
        await act(async () => resolveMe(ME))
      } else {
        act(() => restoreUser())
      }
      expect(queryClient.getQueryData(['booking', 'old-private-booking', null])).toBeUndefined()
      // Cache removal alone leaves observers displaying old results without fetching.
      expect(fetchFilters).toHaveBeenCalledTimes(1)
      expect(fetchAvailability).toHaveBeenCalledTimes(1)

      fireEvent.click(screen.getByRole('button', { name: 'Quantity 0' }))
      await waitFor(() => expect(screen.getByRole('button', { name: 'Quantity 1' })).toBeEnabled())

      expect([fetchFilters.mock.calls.length, fetchAvailability.mock.calls.length]).toEqual([1, 1])
      fireEvent.click(screen.getByRole('button', { name: 'Quantity 1' }))
      await waitFor(() => expect(screen.getByRole('button', { name: 'Quantity 2' })).toBeEnabled())
      expect([fetchFilters.mock.calls.length, fetchAvailability.mock.calls.length]).toEqual([1, 1])
      expect(queryClient.getQueryData(['search-filters'])).toEqual({ bedTypes: [] })
      expect(queryClient.getQueryData(availabilityKey)).toEqual([{ id: 'room' }])
    },
  )
})

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
