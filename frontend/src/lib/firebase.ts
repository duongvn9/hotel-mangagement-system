import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { env } from './env'

/** null khi chưa điền VITE_FIREBASE_*: màn đăng nhập chuyển sang chế độ dev (chọn tài khoản seed). */
export const firebaseAuth = env.firebase.apiKey ? getAuth(initializeApp(env.firebase)) : null
