# UI prototype (tham chiếu, chỉ đọc)

Bản sao của <https://github.com/yunkhngn/stayflow-hotel-harmony> tại commit
`b6a0a602d5b12a4c505072ed2bd183153b1eea46`. Đây là thiết kế mà mọi trang trong `frontend/` phải
giống. Bản chạy thử: <https://stayflow-hotel-harmony.lovable.app>

**Không sửa, không import từ app.** Thư mục này nằm ngoài tsc, oxlint, prettier, vitest và Docker
context của `frontend/`. Muốn đổi thiết kế thì đổi ở repo gốc của prototype rồi copy lại.

`AGENTS.md` ở đây là của Lovable (nói về git history và sync Lovable), **không áp dụng** cho repo
này; quy tắc làm việc nằm ở `CLAUDE.md`, `DESIGN.md` và `docs/UI-REPOLISH-GUIDE.md` ở gốc repo.

## Chạy để so sánh

```bash
cd ui-prototype
bun install            # hoặc: npm install --legacy-peer-deps
bun run dev            # hoặc: npm run dev
```

Prototype dùng dữ liệu mock; chọn vai trò bằng bộ chuyển vai trò trong khu `/app`.

## Nên đọc ở đâu

| Đường dẫn | Nội dung |
|---|---|
| `src/styles.css` | Token màu/chữ/bo góc/bóng (nguồn của `design-system/tokens.css` và `theme.css`) |
| `src/routes/` | Mỗi file là một màn (TanStack file-based routing); `app.*.tsx` là khu làm việc |
| `src/lib/nav.ts` | Menu theo vai trò và quyền vào trang |
| `src/components/hms/` | Component ứng dụng (StatusBadge, PageHeader, DataTable, SiteLayout…) |
| `src/components/ui/` | Primitive shadcn/ui |
| `src/assets/` | Ảnh dùng trong thiết kế |

Màn nào có nhãn "Đề xuất UX" (`Proposed`) là đề xuất chưa có backend: không triển khai.
