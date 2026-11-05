import { Outlet, useLocation } from 'react-router'
import { SiteLayout, type SiteLink } from '@/components/templates'
import { UserMenu } from '@/features/auth/UserMenu'
import { env } from '@/lib/env'
import { siteContent } from '@/lib/site-content'

const LINKS: SiteLink[] = [
  { to: '/', label: 'Trang chủ' },
  { to: '/search', label: 'Phòng & suite' },
  { to: '/experiences', label: 'Trải nghiệm' },
  { to: '/booking/lookup', label: 'Tra cứu đặt phòng' },
]

/** Khung cho khách và Customer: header gọn, dưới 768px menu thu sau nút mở. */
export function PublicLayout() {
  const { pathname } = useLocation()
  const isOverlay = pathname === '/'

  return (
    <SiteLayout
      overlay={isOverlay}
      brand={env.appName}
      links={LINKS}
      actions={<UserMenu compact overlay={isOverlay} />}
      footerTagline={siteContent.tagline}
      footerLinks={LINKS}
      footerContact={[siteContent.address, siteContent.phone, siteContent.email]}
    >
      <Outlet />
    </SiteLayout>
  )
}
