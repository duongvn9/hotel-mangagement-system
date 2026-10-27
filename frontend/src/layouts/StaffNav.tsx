import { Link, NavLink } from 'react-router'
import type { NavGroup } from '@/app/navigation'

/** Menu theo nhóm của khung nhân viên; mục đang mở được React Router gắn aria-current="page". */
export function StaffNav({ groups }: { groups: NavGroup[] }) {
  return (
    <nav aria-label="Menu nhân viên" className="flex flex-1 flex-col overflow-y-auto px-3 py-4">
      <div className="flex-1">
        {groups.length === 0 ? (
          <p className="px-3 text-sm text-stone-300">
            Chưa có mục menu cho vai trò này. Liên hệ quản lý để được cấp quyền.
          </p>
        ) : (
          groups.map((group) => (
            <div key={group.label} className="mb-6">
              <p className="px-3 pb-2 text-xs font-semibold tracking-wider text-stone-300 uppercase">
                {group.label}
              </p>
              <ul className="space-y-0.5">
                {group.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      className={({ isActive }) =>
                        `flex min-h-11 items-center rounded px-3 text-sm transition-colors duration-150 motion-reduce:transition-none ${
                          isActive
                            ? 'bg-pearl-700 font-semibold text-white'
                            : 'text-cream-100 hover:bg-pearl-800'
                        }`
                      }
                    >
                      {item.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>
      <div className="border-t border-pearl-700 pt-3">
        <Link
          to="/"
          className="flex min-h-11 items-center rounded px-3 text-sm text-stone-300 transition-colors duration-150 hover:bg-pearl-800 hover:text-white motion-reduce:transition-none"
        >
          Xem trang khách
        </Link>
      </div>
    </nav>
  )
}
