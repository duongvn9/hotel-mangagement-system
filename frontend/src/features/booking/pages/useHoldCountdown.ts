import { useEffect, useState } from 'react'

/**
 * Đếm ngược tới thời điểm giữ phòng hết hạn (mốc do backend cấp). Trả về mili-giây còn lại,
 * hoặc null khi không có mốc. Nguồn thời gian là server-authoritative: client chỉ hiển thị.
 */
export function useHoldCountdown(target?: string): number | null {
  const [remaining, setRemaining] = useState<number | null>(() =>
    target ? Date.parse(target) - Date.now() : null,
  )
  useEffect(() => {
    if (!target) return
    const tick = () => setRemaining(Date.parse(target) - Date.now())
    // oxlint-disable-next-line react/set-state-in-effect -- đồng bộ đồng hồ đếm ngược với timer
    tick()
    const timer = window.setInterval(tick, 1000)
    return () => window.clearInterval(timer)
  }, [target])
  return target ? remaining : null
}

/** mm:ss còn lại (không âm). */
export function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}
