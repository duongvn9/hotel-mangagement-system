/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Dev server chuyển /api sang backend nên frontend không cần lo CORS.
  // Chạy bằng Docker: http://backend:3000; chạy trực tiếp: http://localhost:3000
  const apiTarget = env.VITE_PROXY_TARGET || 'http://localhost:3000'
  const isDocker = fs.existsSync('/.dockerenv') || process.env.CHOKIDAR_USEPOLLING === 'true'

  return {
    // Keep Vite's cache separate from the locked node_modules/.vite directory on Windows.
    cacheDir: '.vite',
    build: {
      emptyOutDir: false,
    },
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: {
      host: '0.0.0.0',
      port: 5173,
      strictPort: true,
      proxy: { '/api': { target: apiTarget, changeOrigin: true } },
      // cho phép import ../design-system (nằm ngoài thư mục frontend)
      fs: { allow: ['..'] },
      watch: {
        usePolling: isDocker,
      },
    },
    preview: { port: 4173 },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.ts'],
      css: false,
      coverage: {
        include: ['src/**/*.{ts,tsx}'],
        exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**', 'src/main.tsx'],
      },
    },
  }
})
