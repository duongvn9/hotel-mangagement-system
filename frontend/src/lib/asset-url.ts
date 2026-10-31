export function assetUrl(path?: string): string | undefined {
  if (!path) return undefined
  return (import.meta.env.VITE_ASSET_BASE_URL ?? '').replace(/\/$/, '') + path
}
