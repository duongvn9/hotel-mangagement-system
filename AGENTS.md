# HMS — hướng dẫn cho AI/dev

Hotel Management System: `backend/` (NestJS, MongoDB), `frontend/` (React 19, Vite, react-router, Tailwind 4). Node >= 24.

## Làm việc với giao diện
- **Bắt buộc đọc** [`DESIGN.md`](DESIGN.md) và [`UI-REPOLISH-GUIDE.md`](UI-REPOLISH-GUIDE.md) trước khi đụng vào UI.
- Trang nào đã migrate phải **giống prototype** ở [`ui-prototype/`](ui-prototype/) (chỉ đọc, không sửa, không import từ app).
- Chỉ import component từ `@/components/atoms | molecules | organisms | templates`; không import `components/ui/` hay component cũ (`@deprecated`) ở trang đã migrate.
- Màu và cỡ chữ chỉ dùng token/lớp ngữ nghĩa (`bg-card`, `text-muted-foreground`…), không hex.

## Quy ước
- Commit nhỏ, Conventional Commits; chỉ `git add` đường dẫn cụ thể (không `git add -A`); không commit `.env*`, file khóa dịch vụ.
- Kiểm tra trong `frontend/`: `npm run typecheck && npm run lint && npm run format:check && npm test && npm run build`.
- Đổi hành vi thì viết test trước. Đừng sửa test hành vi để "cho đẹp".
