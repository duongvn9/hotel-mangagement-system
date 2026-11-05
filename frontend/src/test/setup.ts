import '@testing-library/jest-dom/vitest'

// jsdom không có ResizeObserver; recharts (ResponsiveContainer) và radix cần nó.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}
