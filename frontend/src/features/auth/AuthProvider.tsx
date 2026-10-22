import {
  createUserWithEmailAndPassword,
  deleteUser,
  onAuthStateChanged,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { queryClient } from '@/app/query-client'
import { getErrorMessage, setAuthTokenProvider, setDevUser } from '@/lib/api-client'
import { firebaseAuth } from '@/lib/firebase'
import { getMe, registerAccount, type Me } from './api'
import { AuthContext, type AuthContextValue } from './auth-context'
import { firebaseErrorMessage } from './firebase-errors'

const DEV_USER_KEY = 'hms.devUser'

/**
 * Phiên đăng nhập (UC02, UC03). Có Firebase: đăng nhập email/mật khẩu rồi gọi /auth/me để backend
 * kiểm tra tài khoản HMS. Chưa có Firebase: chọn tài khoản seed, api gửi header x-dev-*.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null)
  // Không có Firebase và chưa chọn tài khoản dev thì biết ngay là chưa đăng nhập.
  const [status, setStatus] = useState<AuthContextValue['status']>(() =>
    firebaseAuth || localStorage.getItem(DEV_USER_KEY) ? 'loading' : 'anonymous',
  )

  // Đang đăng ký: Firebase tự đăng nhập tài khoản mới, không coi đó là một phiên HMS.
  const registering = useRef(false)

  const loadMe = useCallback(async () => {
    setMe(await getMe())
    setStatus('authenticated')
  }, [])

  const clearSession = useCallback(() => {
    setAuthTokenProvider(null)
    setDevUser(null)
    localStorage.removeItem(DEV_USER_KEY)
    setMe(null)
    setStatus('anonymous')
    queryClient.clear()
  }, [])

  // Khôi phục phiên khi tải lại trang.
  useEffect(() => {
    const auth = firebaseAuth
    if (auth) {
      return onAuthStateChanged(auth, (user) => {
        if (registering.current) return
        if (!user) return clearSession()
        setAuthTokenProvider(() => user.getIdToken())
        loadMe().catch(() => signOut(auth))
      })
    }
    const saved = localStorage.getItem(DEV_USER_KEY)
    if (!saved) return
    setDevUser(JSON.parse(saved))
    // oxlint-disable-next-line react/set-state-in-effect -- setState chạy sau await, không đồng bộ
    loadMe().catch(() => clearSession())
  }, [loadMe, clearSession])

  const value = useMemo<AuthContextValue>(
    () => ({
      me,
      status,
      isDevMode: !firebaseAuth,
      async login(email, password) {
        if (!firebaseAuth) throw new Error('Chưa cấu hình Firebase')
        const credential = await signInWithEmailAndPassword(firebaseAuth, email, password).catch(
          (error) => {
            throw new Error(firebaseErrorMessage(error))
          },
        )
        setAuthTokenProvider(() => credential.user.getIdToken())
        try {
          await loadMe()
        } catch (error) {
          // Firebase hợp lệ nhưng HMS từ chối (chưa xác minh email, bị khoá, chưa đăng ký).
          await signOut(firebaseAuth)
          throw new Error(getErrorMessage(error, 'Không đăng nhập được'))
        }
      },
      async loginAsDev(account) {
        const devUser = { id: account.id, role: account.role }
        setDevUser(devUser)
        localStorage.setItem(DEV_USER_KEY, JSON.stringify(devUser))
        await loadMe()
      },
      async register({ email, password, ...profile }) {
        if (!firebaseAuth) throw new Error('Chưa cấu hình Firebase')
        registering.current = true
        try {
          const { user } = await createUserWithEmailAndPassword(
            firebaseAuth,
            email,
            password,
          ).catch((error) => {
            throw new Error(firebaseErrorMessage(error))
          })
          try {
            await registerAccount(await user.getIdToken(), profile)
          } catch (error) {
            // Không để lại tài khoản Firebase không có tài khoản HMS tương ứng.
            await deleteUser(user).catch(() => undefined)
            throw new Error(getErrorMessage(error, 'Không đăng ký được'))
          }
          await sendEmailVerification(user)
        } finally {
          await signOut(firebaseAuth)
          registering.current = false
        }
      },
      async logout() {
        if (firebaseAuth) await signOut(firebaseAuth)
        clearSession()
      },
      refresh: loadMe,
    }),
    [me, status, loadMe, clearSession],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}
