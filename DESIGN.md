# DESIGN.md — Design system của Emily Hotel HMS

Bộ giao diện của **Hotel Management System (HMS)**, lấy từ UI prototype
[stayflow-hotel-harmony](https://github.com/yunkhngn/stayflow-hotel-harmony) (bản sao chỉ đọc ở
[`ui-prototype/`](ui-prototype/), bản chạy thử <https://stayflow-hotel-harmony.lovable.app>).

> **Quy tắc số 1:** trang nào đã migrate thì phải **giống prototype**. Prototype là nguồn sự thật; tài liệu
> này mô tả nó và chỉ cách dùng lại. Quy trình làm một trang nằm ở
> [`docs/UI-REPOLISH-GUIDE.md`](docs/UI-REPOLISH-GUIDE.md).

## Mục lục

1. [Nguyên tắc](#1-nguyên-tắc)
2. [Màu sắc (token)](#2-màu-sắc-token)
3. [Typography](#3-typography)
4. [Spacing và layout](#4-spacing-và-layout)
5. [Bo góc, bóng, chuyển động](#5-bo-góc-bóng-chuyển-động)
6. [Icon và ảnh](#6-icon-và-ảnh)
7. [Atomic design và catalog component](#7-atomic-design-và-catalog-component)
8. [Pattern theo màn hình](#8-pattern-theo-màn-hình)
9. [Accessibility](#9-accessibility)
10. [Lớp tương thích cũ (legacy)](#10-lớp-tương-thích-cũ-legacy)
11. [Cách làm việc](#11-cách-làm-việc)

| File | Nội dung |
|---|---|
| `design-system/tokens.css` | Biến CSS `:root` (nguồn chuẩn của màu, bo góc). Khớp từng dòng với `ui-prototype/src/styles.css` |
| `design-system/theme.css` | Ánh xạ token sang lớp Tailwind v4 + utility riêng (`font-display`, `card-soft`, `no-scrollbar`, `hero-scrim`) |
| `design-system/legacy.css` | Màu và cỡ chữ của bộ cũ, **deprecated**, xóa khi hết trang cũ |
| `design-system/preview.html` | Trang tĩnh xem nhanh màu, chữ, bo góc, bóng (mở trực tiếp trên trình duyệt) |
| `frontend/src/styles/tokens.test.ts` | Test báo lỗi nếu `tokens.css` lệch prototype |

---

## 1. Nguyên tắc

1. **Sang trọng, tĩnh lặng.** Nền sáng ấm, nhiều khoảng trắng, màu nhấn nâu đồng (`primary`), chữ tiêu đề lớn dùng serif (Playfair).
2. **Thẻ mềm.** Khối nội dung là `card-soft`: nền trắng, viền mảnh, bo `xl`, bóng rất nhẹ. Không bóng nặng, không gradient sặc sỡ (gradient duy nhất là mục menu đang chọn và lớp `hero-scrim` trên ảnh).
3. **Ảnh là nhân vật chính** ở trang khách; khu làm việc gọn, dày thông tin, thanh bên tối (`ink`).
4. **Trạng thái bằng chấm màu + chữ** (`StatusBadge`), không tô cả ô.
5. **Tiếng Việt là mặc định.** Be Vietnam Pro và Playfair Display đều hỗ trợ đủ dấu; kiểm tra chữ có dấu ở cỡ nhỏ.
6. **Chỉ dùng token.** Không hex, không `oklch()` hay px tùy ý trong trang; thiếu token thì thêm vào `tokens.css` + `theme.css` và cập nhật prototype trước.

---

## 2. Màu sắc (token)

Mọi màu là biến CSS `oklch` trong [`design-system/tokens.css`](design-system/tokens.css); dùng qua lớp Tailwind ngữ nghĩa
(`bg-primary`, `text-muted-foreground`...), **không** dùng giá trị trực tiếp.

| Nhóm | Lớp Tailwind | Vai trò |
|---|---|---|
| Nền trang | `bg-background` / `text-foreground` | Nền và chữ mặc định |
| Thẻ, popover | `bg-card` `text-card-foreground`, `bg-popover` | Thẻ `card-soft`, hộp thoại, menu thả |
| **Primary** | `bg-primary` `text-primary-foreground`, `text-primary`, `ring-ring` | Nút chính, liên kết, trạng thái chọn, focus ring |
| Phụ | `bg-secondary`, `bg-muted`, `bg-surface` (cùng tông be nhạt) | Nền khối phụ, ô lọc, hàng hover |
| Chữ phụ | `text-muted-foreground` | Mô tả, nhãn, số phụ |
| Accent | `bg-accent` `text-accent-foreground`, `bg-lavender`, `text-info` | Điểm nhấn tím nhạt, nhãn "đề xuất" của prototype |
| **Ink** | `bg-ink` `text-ink-foreground` | Thanh bên, footer, ảnh phủ chữ (nền tối của thiết kế) |
| Viền, ô nhập | `border-border`, `border-input` | Viền thẻ, bảng; viền ô nhập |
| Trạng thái | `text-success` `text-warning` `text-info` `text-danger` `text-destructive` `text-neutral` | Chấm/chữ trạng thái, lỗi |
| Biểu đồ | `var(--chart-1)` … `var(--chart-5)` | Màu series biểu đồ |
| Thanh bên | `--sidebar-*` | Dành cho sidebar kiểu shadcn (prototype dùng `ink`) |

Quy tắc:
- Chữ trên nền màu dùng cặp `*-foreground` tương ứng.
- Độ trong suốt viết kiểu Tailwind (`bg-primary/10`, `text-ink-foreground/65`); không tạo màu mới.
- Không dùng màu để truyền đạt thông tin một mình (luôn kèm chữ hoặc icon).

---

## 3. Typography

| Vai trò | Font | Lớp |
|---|---|---|
| Nội dung, UI | **Be Vietnam Pro** 400/500/600/700 | mặc định (`font-sans`) |
| Tiêu đề lớn, trích dẫn | **Playfair Display** 400/500/600 | `font-display` (= serif, weight 400, `letter-spacing: -0.01em`) |

Thang chữ prototype dùng thực tế (đếm trong `ui-prototype/src/routes`):

| Dùng cho | Lớp |
|---|---|
| Nội dung, ô bảng, nút | `text-sm` (cỡ phổ biến nhất) |
| Nhãn, chú thích, chip | `text-xs`; nhãn cực nhỏ `text-[11px]`/`text-[10px]` + `uppercase tracking-wider` |
| Tiêu đề trang khu làm việc | `text-2xl font-semibold tracking-tight sm:text-[28px]` (xem `PageHeader`) |
| Tiêu đề phần | `text-sm font-semibold` trong `Panel`; `font-display text-3xl/4xl` ở trang khách |
| Hero, tiêu đề đăng nhập | `font-display text-5xl` (có khi `text-6xl`, `leading-[1.15]`) |
| Số liệu thẻ thống kê | `text-2xl font-semibold tracking-tight` |

Eyebrow (dòng nhỏ phía trên tiêu đề): `text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground`.

---

## 4. Spacing và layout

- Thang spacing mặc định của Tailwind (đơn vị 4px). Khoảng cách chuẩn: `gap-2/3/4`, `p-4/5`, thẻ `p-5`, hộp thoại `p-6`.
- **Khu khách (`SiteLayout`)**: header cao `h-20`, nội dung `max-w-7xl`, lề ngang `px-5 lg:px-8`; footer nền `ink`, `mt-24`.
- **Khu làm việc (`WorkspaceLayout`)**: thanh bên cố định `w-64` (ẩn dưới `lg`, thay bằng ngăn kéo `Sheet` rộng `w-72`), header dính `h-16`, nội dung `max-w-7xl px-4 py-8 sm:px-8`.
- **Đăng nhập (`AuthLayout`)**: lưới 2 cột từ `lg` (form `max-w-md` + ảnh bo `3xl`).
- Điểm gãy: dùng breakpoint mặc định Tailwind (`sm` 640, `md` 768, `lg` 1024). Mọi trang phải dùng được ở 375px.

---

## 5. Bo góc, bóng, chuyển động

| Token | Giá trị | Dùng |
|---|---|---|
| `--radius` | `0.875rem` | Gốc; `rounded-sm…4xl` suy ra từ đây (`lg` = radius, `xl` = +4px, `2xl` = +8px, `3xl` = +12px) |
| `rounded-full` | | Nút bấm chính, chip, ô tìm kiếm, avatar, nút tròn |
| `rounded-xl` | | Thẻ (`card-soft`), mục menu, khối trống |
| `rounded-md` | | Ô nhập, nút mặc định của shadcn |
| `shadow-soft` | | `card-soft` |
| `shadow-lift` | | Thanh tìm kiếm nổi, thẻ nâng |
| `shadow-sm` / `shadow-lg` | | Nút, menu thả, menu mobile |

Chuyển động ngắn: `transition-colors`, `duration-200/300`, `ease-out`. Mục menu hover dịch `translate-x-1`. Animation vào/ra của hộp thoại, popover do `tw-animate-css`. Tôn trọng `prefers-reduced-motion` khi thêm animation mới.

---

## 6. Icon và ảnh

- Icon: **lucide-react**, cỡ `size-4` (chuẩn trong nút, hàng), `size-3` (chấm phụ), `size-5/6` (khối nhấn). Tên icon phải trùng prototype.
- Ảnh: dùng ảnh trong `ui-prototype/src/assets/` (lobby, hero, các hạng phòng, spa...). Ảnh phủ chữ dùng `hero-scrim`; ảnh trong thẻ bo theo thẻ, `object-cover`.
- Avatar: chữ cái đầu trên nền `bg-primary/15 text-primary`.

---

## 7. Atomic design và catalog component

```
components/
  ui/          shadcn gốc (vendor) — KHÔNG import trực tiếp từ trang
  atoms/       phần tử nhỏ nhất
  molecules/   ghép vài atom thành một đơn vị dùng được
  organisms/   khối hoàn chỉnh (tiêu đề trang, bảng, hộp thoại, biểu đồ)
  templates/   khung trang
  *.tsx        component cũ (deprecated)
```

**Quy tắc import:** trang chỉ import từ `@/components/atoms | molecules | organisms | templates`. Cần component chưa có thì thêm đúng tầng
(kèm test), không viết trong trang. Cần primitive shadcn mới: copy từ prototype vào `ui/` rồi re-export ở tầng phù hợp.

### Atoms — `@/components/atoms`

| Component | Ghi chú |
|---|---|
| `Button` | `variant`: `default` `destructive` `outline` `secondary` `ghost` `link`; `size`: `default` `sm` `lg` `icon`; `asChild`. Nút chính trong prototype thường thêm `rounded-full` |
| `Input`, `Textarea`, `Label`, `Checkbox`, `Switch`, `RadioGroup`/`RadioGroupItem`, `Slider`, `Toggle`, `Separator` | Form và điều khiển cơ bản |
| `Avatar`, `AvatarFallback`, `AvatarImage` | |
| `Skeleton` | Khung chờ tải (`animate-pulse`) |
| `StatusBadge` | `status` (mã enum, ví dụ `CHECKED_IN`): chấm màu + nhãn tiếng Việt; trạng thái lạ → trung tính |
| `Logo` | `light` (trên nền tối), `to`, `name` (thương hiệu; chữ cái đầu làm huy hiệu) |

### Molecules — `@/components/molecules`

| Component | Ghi chú |
|---|---|
| `FormField` | `label`, `htmlFor`, `error`, `hint`, `required` + control con có `id` trùng `htmlFor`. Lỗi hiện `role="alert"` |
| `Select` (+ `SelectTrigger/Content/Item/Value`), `Tabs`, `Popover`, `Tooltip`, `DropdownMenu` | Composite của radix |
| `StatCard` | `label`, `value`, `hint`, `trend`, `icon` |
| `EmptyState` | `title`, `body`, `action`, `icon` |
| `KeyValue` | Cặp nhãn – giá trị trong chi tiết |
| `Stars` | `value`, `onChange?` (không có `onChange` thì chỉ đọc) |
| `DateRangeField` | `from`, `to` (`yyyy-MM-dd`), `onChange(from, to)`; ngày trả luôn sau ngày nhận ≥ 1 ngày |
| `SectionHeading` | `eyebrow`, `title`, `body`, `align`, `as` (`h1` hoặc `h2`) |
| `PhotoTile` | `src`, `alt`, `caption`, `aspect` (`square`, `4/3`, `3/4`) |
| `Toaster` | Gắn một lần ở gốc app; gọi `toast()` từ `sonner` |

### Organisms — `@/components/organisms`

| Component | Ghi chú |
|---|---|
| `PageHeader` | `title`, `subtitle`, `eyebrow`, `actions` — đầu mọi trang khu làm việc |
| `Panel` | Thẻ có tiêu đề + `action` |
| `DataTable<T>` | `rows`, `columns`, `search`, `filters`, `pageSize`, `onRowClick`, `toolbar`, `empty`, `loading` — phân trang, tìm kiếm, lọc, trạng thái trống/đang tải |
| `Dialog*`, `AlertDialog*`, `Sheet*` | Hộp thoại, xác nhận, ngăn kéo |
| `RevenueArea`, `SimpleBars`, `Donut` | Biểu đồ (recharts) theo màu `--chart-*` |
| `SearchBar` | Thanh tìm phòng; `initial`, `onSearch({ from, to, guests })`, `ariaLabel` |
| `HeroBanner` | `image`, `imageAlt`, `title`, `eyebrow`, `tall`, `children` |
| `RoomCard` | `image`, `name`, `description`, `amenities`, `price`, `priceNote`, `meta`, `actions`, `selected`, `onToggle`, `toggleLabel` |
| `Unauthorized` | Trang 403; `homeTo`, `actionLabel`, `description` |

### Templates — `@/components/templates`

| Component | Ghi chú |
|---|---|
| `SiteLayout` | Khung khu khách: `links`, `actions`, `overlay` (header đè lên hero), `brand`, `navLabel`, `footerLinks`, `footerContact`, `footerTagline` |
| `WorkspaceLayout` | Khung khu làm việc: `groups` (menu theo nhóm), `user`, `workspaceLabel`, `onLogout`, `profileTo`, `publicSiteTo`, `loading`, `forbidden`; `children` mặc định `<Outlet />` |
| `AuthLayout` | `title`, `subtitle`, `image`, `quote` |

Các template thuần trình bày, **chưa** thay `layouts/StaffLayout` và `PublicLayout` (còn chứa logic đăng nhập); việc nối hai bên là một task riêng.

---

## 8. Pattern theo màn hình

| Màn | Cấu tạo |
|---|---|
| Danh sách (đặt phòng, phòng, tài khoản...) | `PageHeader` (+ nút hành động) → `DataTable` (tìm kiếm, lọc, `StatusBadge`, `onRowClick` đi tới chi tiết) |
| Dashboard | `PageHeader` → lưới `StatCard` → `Panel` chứa biểu đồ/danh sách ngắn |
| Chi tiết | `PageHeader` → `Panel` + `KeyValue`, nút hành động ở `actions` |
| Form | `Panel` → `FormField` + `Input/Select/Textarea`; lỗi theo trường, nút chính `Button` (đổi nhãn khi đang gửi) |
| Xác nhận nguy hiểm | `AlertDialog` (nút hủy + nút `destructive`), không dùng `window.confirm` |
| Không có dữ liệu | `EmptyState` (có hành động tiếp theo nếu được) |
| Đang tải | `Skeleton` cùng hình dạng nội dung (hoặc `DataTable loading`) |
| Không đủ quyền | `Unauthorized` |
| Thông báo ngắn | `toast()` (sonner) |

---

## 9. Accessibility

- Có ring khi focus bàn phím trên mọi điều khiển (shadcn dùng `focus-visible:ring-ring`); không bỏ `outline` mà không thay thế.
- Nút chỉ có icon phải có `aria-label` (ví dụ "Trang sau", "Mở menu").
- Trạng thái luôn kèm chữ; lỗi form dùng `role="alert"` và liên kết nhãn với ô nhập qua `htmlFor`.
- Mục menu đang mở có `aria-current="page"`; nhóm thu gọn có `aria-expanded`.
- Ngăn kéo/hộp thoại có tiêu đề (`SheetTitle`/`DialogTitle`, có thể `sr-only`).
- Chạm tối thiểu ~36–44px cho nút chính; kiểm tra chữ có dấu ở cỡ nhỏ.

---

## 10. Lớp tương thích cũ (legacy)

Trong lúc nhiều người migrate song song, `design-system/legacy.css` giữ các lớp của bộ "Grand Emily" cũ
(`bg-pearl-900`, `text-stone-700`, `border-stone-300`, `bg-cream-100`, `bg-success-bg`, `font-body`,
`max-w-container`, `tracking-widest`...). **Trang đã migrate không được dùng chúng.** Khi đổi một trang, thay như sau:

| Cũ | Mới |
|---|---|
| `bg-cream-100`, `bg-cream-50` | `bg-background` (nền trang), `bg-card` (thẻ), `bg-surface` (nền phụ) |
| `text-pearl-900`, `bg-pearl-900` | `text-foreground`, `bg-ink` |
| `text-stone-700`, `text-stone-500` | `text-muted-foreground` |
| `border-stone-300`, `bg-stone-200` | `border-border`, `bg-muted` / `bg-surface` |
| `bg-primary` + `hover:bg-primary-hover`, `bg-brandy-*` | `Button` (default) / `bg-primary hover:bg-primary/90` |
| `bg-primary-soft`, `bg-brandy-100` | `bg-primary/10` |
| `bg-success-bg text-success` (tương tự warning/danger/info) | `StatusBadge`, hoặc `bg-success/10 text-success` |
| `text-gold-500` | `text-primary` |
| `font-display` (Cormorant) | `font-display` (nay là Playfair) |
| `font-body` | mặc định (đã là Be Vietnam Pro) |
| `max-w-container` | `max-w-7xl` |
| `tracking-widest` (0.2em) | `tracking-[0.2em]` chỉ cho eyebrow viết hoa |
| `Button`/`Badge`/`TextField`... trong `components/*.tsx` | Xem mục 7 (các file cũ đã gắn `@deprecated`) |

### Đã migrate: khu khách

- **Vỏ & landing:** `HomePage`, `ExperiencesPage`, `NotFoundPage`, `Unauthorized`, `PublicLayout`, `UserMenu`
- **Tìm và xem phòng:** `SearchRoomsPage`, `RoomDetailsPage`
- **Đặt phòng:** `CreateBookingPage`, `LookupBookingPage`, `BookingDetailPage`, `PaymentReturnPage`
- **Tài khoản khách:** `LoginPage`, `RegisterPage` (với `AuthLayout`), `ProfilePage`, `MyBookingsPage`

Khi trang cuối cùng đã migrate: xóa `design-system/legacy.css`, dòng `@import` tương ứng trong `frontend/src/styles/index.css`
và các component cũ.

---

## 11. Cách làm việc

1. Mở prototype (`ui-prototype/`, hoặc bản chạy thử) ở đúng màn cần làm và đọc code của nó.
2. Dùng component ở mục 7; thiếu thì thêm đúng tầng kèm test.
3. Chỉ đổi phần trình bày; giữ hook, API, logic và test hành vi.
4. So sánh với prototype ở 1440px và 375px trước khi mở PR.

Chi tiết, bảng ánh xạ màn prototype ↔ trang của app, danh sách cấm và prompt mẫu cho AI:
[`docs/UI-REPOLISH-GUIDE.md`](docs/UI-REPOLISH-GUIDE.md).

Đổi hoặc thêm token: sửa `design-system/tokens.css` (và `theme.css` nếu cần lớp mới) **sau khi** prototype đã đổi, rồi chạy
`npm test` trong `frontend/` để xác nhận không lệch.
