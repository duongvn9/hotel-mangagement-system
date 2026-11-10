const MESSAGES: Record<string, string> = {
  'auth/invalid-credential': 'Email hoặc mật khẩu không đúng',
  'auth/invalid-email': 'Email không hợp lệ',
  'auth/user-disabled': 'Tài khoản đã bị khoá',
  'auth/too-many-requests': 'Thử sai quá nhiều lần, vui lòng thử lại sau',
  'auth/network-request-failed': 'Không kết nối được máy chủ xác thực',
  'auth/email-already-in-use': 'Email đã được sử dụng',
  'auth/weak-password': 'Mật khẩu phải có ít nhất 6 ký tự',
  'auth/popup-closed-by-user': 'Bạn đã đóng cửa sổ đăng nhập Google',
  'auth/cancelled-popup-request': 'Bạn đã đóng cửa sổ đăng nhập Google',
  'auth/popup-blocked':
    'Trình duyệt đã chặn cửa sổ đăng nhập Google, hãy cho phép popup rồi thử lại',
  'auth/unauthorized-domain': 'Tên miền này chưa được phép đăng nhập bằng Google',
}

/** Đổi lỗi Firebase Auth (có `code`) sang câu tiếng Việt. */
export function firebaseErrorMessage(error: unknown): string {
  const code = (error as { code?: string } | null)?.code ?? ''
  return MESSAGES[code] ?? 'Không xác thực được, vui lòng thử lại'
}
