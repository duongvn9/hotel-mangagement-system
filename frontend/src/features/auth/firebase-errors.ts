const MESSAGES: Record<string, string> = {
  'auth/invalid-credential': 'Email hoặc mật khẩu không đúng',
  'auth/invalid-email': 'Email không hợp lệ',
  'auth/user-disabled': 'Tài khoản đã bị khoá',
  'auth/too-many-requests': 'Thử sai quá nhiều lần, vui lòng thử lại sau',
  'auth/network-request-failed': 'Không kết nối được máy chủ xác thực',
  'auth/email-already-in-use': 'Email đã được sử dụng',
  'auth/weak-password': 'Mật khẩu phải có ít nhất 6 ký tự',
}

/** Đổi lỗi Firebase Auth (có `code`) sang câu tiếng Việt. */
export function firebaseErrorMessage(error: unknown): string {
  const code = (error as { code?: string } | null)?.code ?? ''
  return MESSAGES[code] ?? 'Không xác thực được, vui lòng thử lại'
}
