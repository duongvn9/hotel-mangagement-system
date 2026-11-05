# UI repolish foundation — design

Ngày: 2026-11-06 · Nhánh: `chore/new-ui` · Người quyết định: Khoa

## 1. Mục đích

UI frontend hiện tại (bộ "Grand Emily": nâu brandy, vàng gold, nền kem, component tự viết) bị đánh giá là xấu.
Đã có một UI prototype do Khoa thiết kế: <https://github.com/yunkhngn/stayflow-hotel-harmony>
(TanStack Start + Tailwind v4 + shadcn/ui new-york + lucide, dữ liệu mock).

Cả nhóm sẽ **migrate từng trang theo các task đã có trên Jira**, và **mỗi trang sau migrate phải giống prototype**.
Việc ở đây không phải là restyle các trang. Đây là việc dựng **nền móng** để các task đó làm nhanh, đồng nhất và có thể kiểm chứng:

1. Hướng dẫn cho AI/dev để repolish một trang cho giống prototype.
2. `DESIGN.md` mới (và các file design-system liên quan) khớp prototype.
3. Bộ component theo atomic design, lấy từ prototype, sẵn để dùng.
4. Bản copy prototype trong repo làm tham chiếu để mọi người lấy token, component, ảnh.

## 2. Goals / Non-goals / Anti-goals

**Goals**
- Một trang migrate xong nhìn giống prototype về màu, chữ, khoảng cách, bo góc, bóng, bố cục, trạng thái hover/focus/empty/loading.
- Mọi người dùng chung một bộ component và token, không ai tự chế Button/Badge riêng.
- Trang chưa migrate vẫn chạy bình thường trong lúc chuyển tiếp.

**Non-goals**
- Không restyle bất kỳ trang feature nào trong task này (việc của các task Jira).
- Không đổi router (giữ react-router), không đổi API, hook, logic, test hành vi.
- Không mang mock data, zustand store, RoleSwitcher, TanStack Router của prototype vào app.
- Không làm dark mode (prototype khai báo variant nhưng không có bộ biến `.dark`).

**Anti-goals** (làm xong về kỹ thuật nhưng vẫn coi là thất bại)
- Một trang "giống tương đối" vì AI tự diễn giải thay vì đọc code prototype.
- Màu/spacing hardcode (`#8A5A3B`, `p-[13px]`) lọt vào trang đã migrate.
- Làm vỡ trang chưa migrate hoặc test hiện có.
- Prototype lọt vào build, lint hoặc tsc của app.

## 3. Ràng buộc

- Frontend hiện chạy Vite + react-router 8 + Tailwind v4 (`@tailwindcss/vite`), alias `@/`. Chưa có radix, lucide, cva, clsx, tailwind-merge.
- Rất nhiều file đang dùng tên token cũ (`pearl-900`, `brandy-100`, `cream-100`, `primary-hover`, `danger`...) và component phẳng ở `frontend/src/components/*.tsx` (Button, Badge, TextField, Alert, SelectField, TextAreaField, ConfirmationDialog, ImagePicker, ImageLightbox, AssetImage...), kèm test.
- Prototype có `AGENTS.md` của Lovable (cảnh báo về git history và sync Lovable). Nội dung đó không áp dụng cho repo này; bản copy chỉ để tham chiếu.
- Ngôn ngữ UI và tài liệu: tiếng Việt. Node >= 24.
- Commit nhỏ, Conventional Commits, mỗi commit tự build/test được (ưu tiên của Khoa).
- Trên nhánh hiện có thay đổi chưa commit không liên quan (`docker-compose.yml`, và file `hotel-c4e11-firebase-adminsdk-*.json` là **khóa dịch vụ Firebase**). Không được đưa các file này vào commit nào của task này.

## 4. Quyết định

### Do Khoa quyết
- Migrate từng trang, theo task Jira, mỗi trang bắt buộc giống prototype.
- Copy source prototype về repo để mọi người dùng chung.
- Tạo sẵn bộ component atomic design.
- Viết lại DESIGN.md theo prototype.

### Do mình quyết (Khoa kiểm tra khi đọc)
| # | Quyết định | Lý do |
|---|---|---|
| A | Token mới theo prototype (shadcn-style: `background`, `foreground`, `card`, `primary`, `muted`, `ink`, `success`...) thay `frontend/src/styles/index.css`. Giữ **lớp alias** cho tên cũ, đánh dấu deprecated, xóa khi hết trang cũ. | Trang cũ vẫn render đúng trong lúc nhiều người migrate song song. |
| B | `components/ui/` = nguyên bản shadcn từ prototype (lớp vendor, trang không import trực tiếp). `atoms/ molecules/ organisms/ templates/` là API công khai mà trang import. Atom đơn giản re-export từ `ui/`, atom đặc thù HMS (StatusBadge...) viết trực tiếp. | Giữ shadcn đúng gốc để dễ so và cập nhật; trang chỉ biết một lối import. |
| C | Component cũ `components/*.tsx` giữ nguyên, thêm `@deprecated` trỏ sang bản mới. Task migrate trang nào thì đổi import ở trang đó. | Không làm vỡ test hiện có; xóa dần ở cuối. |
| D | Prototype copy vào `ui-prototype/` (loại bỏ `.git`, `bun.lock`, `node_modules`), chỉ đọc, nằm ngoài tsconfig/eslint/oxlint/prettier/vitest/Docker context. Giữ nguyên `src/assets` (ảnh) để tái dùng. | Nguồn tham chiếu duy nhất; không ảnh hưởng build. Đặt ở gốc repo thay vì `design-system/` vì `docker-compose.yml` đồng bộ và `Dockerfile` copy cả `design-system/`, sẽ kéo prototype (1,7 MB) vào container. |
| E | Chỉ copy các primitive shadcn thực sự được prototype dùng (không copy cả 46 file), và chỉ thêm các dependency tương ứng. | Tránh kéo dư ~25 gói radix không dùng. |
| F | Màn đánh dấu `Proposed` / "Đề xuất UX" trong prototype (ví dụ Notifications) là đề xuất chưa có backend: **không** triển khai, **không** đưa badge "Đề xuất UX" vào app. | Prototype tự nói rõ đây là đề xuất, không phải tính năng đang có. |
| G | Font Be Vietnam Pro + Playfair Display nạp qua Google Fonts trong `frontend/index.html` như prototype. | Khớp prototype; hỗ trợ đủ dấu tiếng Việt. |
| H | Atomic mapping: **atoms** (Button, Input, Textarea, Label, Checkbox, Switch, Badge, StatusBadge, Avatar, Skeleton, Separator, Spinner, Icon), **molecules** (FormField, SearchBar, DateRangeField, StatCard, Select field, Tabs, Breadcrumb, Pagination), **organisms** (PageHeader, Panel/Card, DataTable, CrudPage, Dialog/Sheet/AlertDialog, Sidebar, charts, Table), **templates** (WorkspaceLayout, SiteLayout, AuthLayout, Unauthorized). Danh sách chốt cuối nằm trong plan, dựa trên những gì prototype thực dùng. | Phân loại theo độ phức tạp ghép; chi tiết sẽ rà lại khi đọc code prototype. |

## 5. Sản phẩm bàn giao

| File / thư mục | Nội dung |
|---|---|
| `ui-prototype/` | Bản copy prototype (chỉ đọc) + `README.md` ngắn: nguồn, commit đã copy, cách chạy để so sánh, "đừng sửa". |
| `frontend/src/styles/index.css` | Token mới + alias cũ (deprecated). |
| `frontend/index.html` | Nạp font. |
| `frontend/src/lib/utils.ts` | `cn()`. |
| `frontend/src/components/ui/` | Primitive shadcn vendor. |
| `frontend/src/components/{atoms,molecules,organisms,templates}/` | Bộ atomic, mỗi cấp có `index.ts` (barrel) và test render/variant cho phần có hành vi. |
| `frontend/src/components/*.tsx` (cũ) | Thêm `@deprecated`, không đổi hành vi. |
| `DESIGN.md` | Viết lại hoàn toàn theo prototype: nguyên tắc, token, typography, spacing, radius/bóng, icon, atomic structure + catalog component, pattern theo màn hình, a11y, cách dùng. Thay bản Grand Emily. |
| `design-system/tokens.css`, `tokens.json`, `tailwind.preset.js`, `preview.html` | Cập nhật theo token mới hoặc loại bỏ nếu thừa; chốt khi viết plan. |
| `docs/UI-REPOLISH-GUIDE.md` | Hướng dẫn cho AI/dev (xem mục 6). |
| `CLAUDE.md` / `AGENTS.md` (gốc repo) | Chỉ trỏ tới guide, DESIGN.md. Tạo nếu chưa có. |

## 6. Nội dung hướng dẫn repolish (cho AI/dev)

1. **Đọc trước khi làm:** DESIGN.md → trang prototype tương ứng trong `ui-prototype/src/routes/` → component nó dùng.
2. **Bảng ánh xạ** màn prototype ↔ trang/route của app (`app.reception.tsx` ↔ ReceptionDashboardPage, ...) và ghi rõ màn nào là `Proposed` (bỏ qua).
3. **Quy trình một trang:** (a) tìm prototype tương ứng; (b) liệt kê atoms/molecules/organisms cần dùng, thiếu thì thêm vào đúng tầng chứ không viết trong trang; (c) giữ nguyên hook/api/logic/test, chỉ đổi phần trình bày; (d) so sánh với prototype ở 1440px và 375px; (e) test + lint + typecheck + build xanh.
4. **"Giống" nghĩa là:** cùng cấu trúc DOM/bố cục, cùng class token, cùng chữ (font/size/weight), cùng khoảng cách, bo góc, bóng, màu, icon (lucide cùng tên), trạng thái hover/focus/disabled/empty/loading. Nội dung dữ liệu thật thay mock, nhưng phải xử lý được trường hợp dài/trống.
5. **Cấm:** hardcode màu/hex/px tùy ý; tự viết lại Button/Badge/Input; import từ `components/ui/` hay component cũ trong trang đã migrate; sửa `ui-prototype/`; mang mock/store/TanStack Router vào app; đổi hành vi hay test để cho "đẹp".
6. **Khi prototype thiếu** state hoặc màn mà app cần: dừng, hỏi Khoa, không tự bịa.
7. **Quy trình PR:** nhánh theo task Jira, commit nhỏ Conventional Commits, PR có ảnh so sánh prototype / app (desktop + mobile) và checklist "giống prototype" đã tích.
8. **Prompt mẫu** để dán cho AI cho một task Jira (điền sẵn chỗ trống: mã task, route app, file prototype).

## 7. Kiểm chứng (cho phần nền móng)

- `npm run typecheck`, `lint`, `test`, `build` ở `frontend/` đều xanh; số test cũ không giảm.
- Test render cho từng atom/molecule có hành vi (Button variant/loading/disabled, StatusBadge ánh xạ trạng thái, DataTable trống/có dữ liệu...), viết trước khi code theo TDD.
- Một trang xem trước tạm thời (không commit) hoặc `design-system/preview.html` cập nhật để so token và component với prototype bằng mắt.
- Xác nhận `ui-prototype/` không bị tsc/lint/vitest/Docker build quét tới.
- `git status` trước mỗi commit: không có `docker-compose.yml` hay file firebase adminsdk.

## 8. Kế hoạch commit (mỗi commit tự chạy được)

1. `docs`: spec này.
2. `chore(design-system)`: copy prototype + README tham chiếu, loại khỏi tooling.
3. `chore(frontend)`: dependencies + `cn()` + font.
4. `feat(frontend)`: token mới + alias cũ.
5. `feat(ui)`: primitives vendor.
6. `feat(ui)`: atoms (kèm test) → molecules → organisms → templates (mỗi tầng một commit).
7. `refactor(ui)`: đánh dấu component cũ `@deprecated`.
8. `docs`: DESIGN.md + design-system/*.
9. `docs`: UI-REPOLISH-GUIDE.md + CLAUDE.md/AGENTS.md.

## 9. Để builder tự xử lý

- Chốt danh sách primitive/atoms/molecules thật sự cần sau khi grep import trong prototype.
- Xác định chính xác các điểm thay đổi khi bỏ TanStack (`Link`, `useLocation`, `createFileRoute`) trong `SiteLayout`, `Sidebar`, `CrudPage` để chuyển sang react-router.
- Quyết định giữ hay bỏ từng file trong `design-system/` cũ.
- Lập bảng ánh xạ route prototype ↔ trang app đầy đủ (đối chiếu `frontend/src/features/*/routes.tsx`).
