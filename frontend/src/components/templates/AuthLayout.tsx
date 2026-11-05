import type { ReactNode } from 'react'
import suite from '@/assets/auth-suite.jpg'
import { Logo } from '../atoms'

export function AuthLayout({
  title,
  subtitle,
  children,
  brand,
  image = suite,
  imageAlt = 'Suite hướng biển',
  quote = '“Nơi khiến bạn muốn quay lại ngay từ buổi tối đầu tiên.”',
  quoteBy = 'Emma Laurent · Suite Hướng Biển',
}: {
  title: string
  subtitle: string
  children: ReactNode
  brand?: string
  image?: string
  imageAlt?: string
  quote?: string
  quoteBy?: string
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <Logo name={brand} />
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
          <h1 className="font-display text-5xl">{title}</h1>
          <p className="mt-2 text-muted-foreground">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </div>
      </div>
      <div className="relative hidden p-4 lg:block">
        <img src={image} alt={imageAlt} className="size-full rounded-3xl object-cover" />
        <div className="absolute inset-x-12 bottom-12 rounded-2xl bg-ink/40 p-6 text-ink-foreground backdrop-blur">
          <p className="font-display text-3xl leading-snug">{quote}</p>
          <p className="mt-3 text-sm text-ink-foreground/70">{quoteBy}</p>
        </div>
      </div>
    </div>
  )
}
