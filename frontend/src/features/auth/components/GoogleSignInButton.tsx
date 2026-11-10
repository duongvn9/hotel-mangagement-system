import { Button } from '@/components/atoms'

/** Đường kẻ "hoặc" và nút đăng nhập Google, dùng chung cho trang đăng nhập và đăng ký. */
export function GoogleSignInButton({
  pending,
  onClick,
}: {
  pending: boolean
  onClick: () => void
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" aria-hidden="true" />
        hoặc
        <span className="h-px flex-1 bg-border" aria-hidden="true" />
      </div>
      <Button
        type="button"
        variant="outline"
        size="lg"
        disabled={pending}
        aria-busy={pending}
        onClick={onClick}
        className="w-full rounded-full"
      >
        <img src="/google.svg" alt="" aria-hidden="true" className="size-4" />
        Tiếp tục với Google
      </Button>
    </div>
  )
}
