// Tailwind dùng chung token với toàn dự án: design-system/tailwind.preset.js
// Đổi màu/font thì sửa trong design-system/, không sửa ở đây (xem DESIGN.md mục 10).
import preset from '../design-system/tailwind.preset.js'

/** @type {import('tailwindcss').Config} */
export default {
  presets: [preset],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
}
