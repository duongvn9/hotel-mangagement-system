import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useAuth } from './auth-context'

/** Góc phải header: link đăng nhập, hoặc tên người dùng + đăng xuất (UC03). */
export function UserMenu() {
  const { me, logout } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState('')

  if (!me) {
    return (
      <Link to="/login" className="hover:text-primary">
        Đăng nhập
      </Link>
    )
  }

  async function onLogout() {
    setError('')
    try {
      await logout()
      navigate('/login')
    } catch {
      setError('Đăng xuất không thành công, vui lòng thử lại')
    }
  }

  return (
    <span className="flex items-center gap-4">
      <Link to="/profile" className="tracking-normal text-pearl-900 normal-case hover:text-primary">
        {me.fullName}
      </Link>
      <button type="button" onClick={onLogout} className="uppercase hover:text-primary">
        Đăng xuất
      </button>
      {error && (
        <span role="alert" className="text-danger normal-case">
          {error}
        </span>
      )}
    </span>
  )
}
