# DESIGN.md — Grand Emily Design System

Design system cho **Hotel Management System (HMS)**, lấy cảm hứng từ shot Dribbble
[Grand Emily Hotel Website](https://dribbble.com/shots/20891256-Grand-Emily-Hotel-Website)
và tinh thần của khách sạn Grand Emily (Lviv, Ukraine): gỗ ốp tối màu, chất liệu tự nhiên,
cảm giác yên tĩnh, sang trọng và gần gũi thiên nhiên (mặt hồ, lau sậy, cây xanh).

> **Lưu ý:** giá trị màu và font trong tài liệu này là bộ chuẩn của dự án, không phải mã màu
> lấy chính xác từ file gốc của shot. Nếu nhóm muốn khớp pixel với shot, chỉnh trong
> `design-system/tokens.css` và `tokens.json`; mọi component dùng token nên sẽ tự cập nhật.

## Mục lục

1. [Nguyên tắc thiết kế](#1-nguyên-tắc-thiết-kế)
2. [Màu sắc](#2-màu-sắc)
3. [Typography](#3-typography)
4. [Spacing, layout và grid](#4-spacing-layout-và-grid)
5. [Radius, shadow, motion](#5-radius-shadow-motion)
6. [Iconography và hình ảnh](#6-iconography-và-hình-ảnh)
7. [Components](#7-components)
8. [Pattern theo màn hình HMS](#8-pattern-theo-màn-hình-hms)
9. [Accessibility](#9-accessibility)
10. [Cách dùng trong code](#10-cách-dùng-trong-code)

File liên quan:

| File | Nội dung |
|---|---|
| `design-system/tokens.css` | Toàn bộ token dạng CSS custom properties (nguồn chuẩn) |
| `design-system/tokens.json` | Cùng bộ token dạng JSON (cho JS, Figma Tokens, mobile) |
| `design-system/tailwind.preset.js` | Preset Tailwind nếu frontend dùng Tailwind |
| `design-system/preview.html` | Trang xem nhanh màu, chữ, component (mở trực tiếp trên trình duyệt) |

---

## 1. Nguyên tắc thiết kế

1. **Sang trọng nhưng tĩnh lặng.** Nhiều khoảng trắng, ít màu, chữ serif lớn cho tiêu đề. Không dùng gradient sặc sỡ hay bóng đổ nặng.
2. **Ấm và tự nhiên.** Nền kem, chữ nâu đen, điểm nhấn vàng đồng. Không dùng xám lạnh hay trắng tinh cho nền trang.
3. **Ảnh là nhân vật chính.** Trang khách (public) để ảnh phòng và không gian chiếm diện tích lớn; UI chỉ làm khung.
4. **Một nhà, hai không gian.** Trang khách (marketing, đặt phòng) dùng giọng "editorial" với serif lớn. Trang nội bộ (lễ tân, quản lý, nhân viên) dùng cùng token nhưng gọn, dày thông tin, ưu tiên Be Vietnam Pro.
5. **Tiếng Việt là mặc định.** Mọi font đã chọn đều hỗ trợ đầy đủ dấu tiếng Việt; luôn kiểm tra chữ có dấu ở cỡ nhỏ.

---

## 2. Màu sắc

### 2.1 Bảng màu thương hiệu

| Token | Hex | Tên | Vai trò |
|---|---|---|---|
| `--ge-pearl-900` | `#1F1B16` | Black Pearl | Chữ chính, nền footer/hero tối, nút "inverse" |
| `--ge-pearl-800` | `#2E2822` | | Hover trên nền tối, sidebar admin |
| `--ge-pearl-700` | `#3D352D` | | Border trên nền tối |
| `--ge-brandy-600` | `#8A5A3B` | Smoked Brandy | **Primary**: nút chính, link, trạng thái active |
| `--ge-brandy-700` | `#6E4529` | | Hover / pressed của primary |
| `--ge-brandy-400` | `#B98A68` | | Icon trang trí, chart |
| `--ge-brandy-100` | `#F1E4D8` | | Nền nhạt cho item được chọn |
| `--ge-gold-500` | `#C9A46A` | Gold | **Accent**: đường kẻ trang trí, sao đánh giá, focus ring, chữ trên nền tối |
| `--ge-gold-200` | `#EADBC0` | | Nền highlight nhẹ |
| `--ge-reed-700` | `#55633F` | Reed | **Secondary**: nút phụ, tag "eco/thiên nhiên" |
| `--ge-reed-100` | `#E6EADB` | | Nền nhạt secondary |
| `--ge-lake-600` | `#3E6577` | Lake | Info, link phụ |

### 2.2 Neutrals (tông ấm)

| Token | Hex | Vai trò |
|---|---|---|
| `--ge-white` | `#FFFFFF` | Card, input, modal |
| `--ge-cream-50` | `#FBF8F3` | Nền hàng xen kẽ trong bảng |
| `--ge-cream-100` | `#F7F2EA` | **Nền trang mặc định** |
| `--ge-stone-200` | `#EAE2D6` | Nền section phụ, nền khung ảnh khi đang tải |
| `--ge-stone-300` | `#DCD2C4` | Border, divider |
| `--ge-stone-500` | `#8C8275` | Placeholder, icon disabled (không dùng cho chữ < 18px) |
| `--ge-stone-700` | `#5E554A` | Chữ phụ, caption, label |

### 2.3 Màu ngữ nghĩa

| Ý nghĩa | Chữ / icon | Nền | Dùng cho |
|---|---|---|---|
| Success | `#3F7350` | `#E2EEE5` | Thanh toán thành công, phòng trống, check-in xong |
| Warning | `#9A6418` | `#F6EAD3` | Sắp hết hạn giữ phòng, phòng đang dọn |
| Danger | `#A8402F` | `#F5E0DB` | Lỗi, huỷ đặt phòng, phòng hỏng / bảo trì gấp |
| Info | `#3E6577` | `#DDE7EC` | Thông báo, phòng đã đặt trước |

### 2.4 Role token (dùng trong component, không dùng mã hex trực tiếp)

| Role token | Giá trị |
|---|---|
| `--color-bg` | cream-100 |
| `--color-surface` / `--color-surface-muted` / `--color-surface-inverse` | white / stone-200 / pearl-900 |
| `--color-text` / `--color-text-muted` / `--color-text-inverse` | pearl-900 / stone-700 / cream-100 |
| `--color-border` / `--color-border-strong` | stone-300 / pearl-900 |
| `--color-primary` / `--color-primary-hover` / `--color-on-primary` | brandy-600 / brandy-700 / white |
| `--color-secondary` / `--color-on-secondary` | reed-700 / white |
| `--color-accent` / `--color-focus` | gold-500 |

### 2.5 Độ tương phản đã kiểm tra (WCAG 2.1)

| Chữ / Nền | Tỉ lệ | Kết quả |
|---|---|---|
| pearl-900 trên cream-100 | 15.4 : 1 | AAA |
| stone-700 trên cream-100 | 6.6 : 1 | AA |
| brandy-600 trên cream-100 | 5.2 : 1 | AA |
| white trên brandy-600 | 5.8 : 1 | AA |
| white trên brandy-700 | 8.3 : 1 | AAA |
| white trên reed-700 | 6.5 : 1 | AA |
| gold-500 trên pearl-900 | 7.3 : 1 | AAA |
| stone-500 trên cream-100 | 3.4 : 1 | Chỉ cho chữ ≥ 18px hoặc phần tử không phải chữ |
| danger / success / warning / info trên white | 6.1 / 5.6 / 5.0 / 6.3 : 1 | AA |

**Quy tắc:** gold-500 **không** dùng làm màu chữ trên nền sáng (tương phản thấp); chỉ dùng cho đường kẻ, icon trang trí, hoặc chữ trên nền pearl-900.

### 2.6 Tỉ lệ sử dụng gợi ý

Khoảng 60% nền kem/trắng, 25% nâu đen (chữ, khối tối), 10% brandy (primary), 5% gold/reed (điểm nhấn).

---

## 3. Typography

### 3.1 Font

| Vai trò | Font | Fallback | Ghi chú |
|---|---|---|---|
| Display / Heading | **Cormorant Garamond** (500, 600, 700, italic 500) | Times New Roman, serif | Serif cổ điển, sang trọng; chỉ dùng từ 24px trở lên |
| Body / UI | **Be Vietnam Pro** (400, 500, 600, 700) | system-ui, Segoe UI, Roboto | Thiết kế cho tiếng Việt, rõ ở cỡ nhỏ |

Cả hai font lấy từ Google Fonts với subset `vietnamese` (đã import sẵn trong `tokens.css`).

### 3.2 Thang cỡ chữ

| Style | Font | Size / Line-height | Weight | Dùng cho |
|---|---|---|---|---|
| Display XL | Cormorant | 72 / 1.05 | 500 | Tiêu đề hero trang chủ (desktop) |
| Display L | Cormorant | 56 / 1.1 | 500 | Hero trang con, tiêu đề hero mobile = 40 |
| H1 | Cormorant | 40 / 1.1 | 600 | Tiêu đề trang |
| H2 | Cormorant | 32 / 1.2 | 600 | Tiêu đề section |
| H3 | Cormorant | 24 / 1.3 | 600 | Tên phòng trên card, tiêu đề modal |
| H4 | Be Vietnam Pro | 20 / 1.3 | 600 | Tiêu đề card trong dashboard |
| Eyebrow | Be Vietnam Pro | 12 / 1.3, uppercase, letter-spacing 0.2em | 600 | Nhãn nhỏ phía trên tiêu đề ("PHÒNG & SUITE") |
| Body L | Be Vietnam Pro | 18 / 1.6 | 400 | Đoạn giới thiệu |
| Body | Be Vietnam Pro | 16 / 1.6 | 400 | Nội dung mặc định |
| Body S | Be Vietnam Pro | 14 / 1.5 | 400 | Bảng, form, chú thích |
| Caption | Be Vietnam Pro | 12 / 1.4 | 500 | Metadata, timestamp |
| Button | Be Vietnam Pro | 14 / 1, uppercase, letter-spacing 0.08em | 600 | Nút |
| Price | Cormorant | 32 / 1 | 600 | Giá phòng ("1.850.000 ₫ / đêm") |

### 3.3 Quy tắc

- Mỗi màn hình chỉ có **một** H1.
- Tiêu đề serif có thể dùng **italic** cho một từ nhấn mạnh ("Trải nghiệm *nghỉ dưỡng* giữa thiên nhiên").
- Không dùng Cormorant cho chữ dưới 24px, bảng, form hay nút.
- Độ dài dòng văn bản tối đa khoảng 70 ký tự (`max-width: 65ch`).
- Định dạng số và tiền theo `vi-VN`: `1.850.000 ₫`, ngày `dd/MM/yyyy`.

---

## 4. Spacing, layout và grid

### 4.1 Thang spacing (bước 4px)

| Token | px | Dùng cho |
|---|---|---|
| `--space-1` | 4 | Khoảng cách icon và chữ |
| `--space-2` | 8 | Gap trong nhóm nhỏ (badge, chip) |
| `--space-3` | 12 | Padding dọc input/nút nhỏ |
| `--space-4` | 16 | Padding card nhỏ, gutter mobile |
| `--space-6` | 24 | Padding card, gutter desktop |
| `--space-8` | 32 | Khoảng cách giữa các khối trong section |
| `--space-12` | 48 | Khoảng cách tiêu đề section và nội dung |
| `--space-16` | 64 | Padding dọc section (mobile) |
| `--space-24` | 96 | Padding dọc section (desktop) |
| `--space-32` | 128 | Khoảng cách hero lớn |

### 4.2 Breakpoints

| Tên | Min width | Cột grid | Gutter | Margin |
|---|---|---|---|---|
| xs (mobile) | 0 | 4 | 16 | 16 |
| sm | 640 | 4 | 16 | 24 |
| md (tablet) | 768 | 8 | 24 | 32 |
| lg | 1024 | 12 | 24 | 40 |
| xl | 1280 | 12 | 24 | auto, container 1200 |
| 2xl | 1440 | 12 | 32 | auto, container 1200 (hero/ảnh full 1440) |

### 4.3 Layout

- **Trang khách:** header cao 80px (trong suốt trên hero, chuyển nền cream + shadow-sm khi cuộn), nội dung trong container 1200px, ảnh hero và gallery có thể tràn full-width.
- **Trang nội bộ:** sidebar trái 264px nền pearl-900, topbar 64px nền white, vùng nội dung nền cream-100 với padding 24–32px.

---

## 5. Radius, shadow, motion

### Radius

| Token | Giá trị | Dùng cho |
|---|---|---|
| `--radius-sm` | 2px | Checkbox, ảnh thumbnail nhỏ |
| `--radius-md` | 4px | Button, input, select, dropdown |
| `--radius-lg` | 8px | Card, modal, toast |
| `--radius-xl` | 16px | Thanh đặt phòng (booking bar), ảnh lớn |
| `--radius-pill` | 999px | Badge, chip, avatar |

Phong cách chung là **góc vuông vắn, bo nhẹ**, tránh bo tròn quá mức.

### Shadow

| Token | Dùng cho |
|---|---|
| `--shadow-sm` | Header khi cuộn, input focus nhẹ |
| `--shadow-md` | Card hover, dropdown |
| `--shadow-lg` | Modal, booking bar nổi trên hero |
| `--shadow-focus` | Focus ring (vàng đồng, 3px) |

### Motion

| Token | Giá trị | Dùng cho |
|---|---|---|
| `--duration-fast` | 120ms | Hover màu nút, link |
| `--duration-base` | 200ms | Dropdown, tab, toast |
| `--duration-slow` | 400ms | Modal, zoom ảnh khi hover card (scale 1.04) |
| `--ease-standard` | cubic-bezier(0.2, 0, 0, 1) | Mặc định |

Tôn trọng `prefers-reduced-motion` (đã cấu hình trong `tokens.css`).

---

## 6. Iconography và hình ảnh

- **Icon:** bộ [Lucide](https://lucide.dev) (stroke 1.5px, góc bo), cỡ 16 / 20 / 24px, màu theo `currentColor`.
- Icon tiện nghi (wifi, hồ bơi, spa, nhà hàng, đỗ xe, điều hoà...) dùng cỡ 24px màu brandy-600 hoặc gold-500 trên nền tối.
- **Ảnh:** tông ấm, ánh sáng tự nhiên, ưu tiên gỗ, cây xanh, mặt hồ. Tỉ lệ: hero 16:9 (mobile 4:5), card phòng 4:3, gallery 3:2 hoặc 1:1.
- Ảnh trên nền chữ dùng lớp phủ `linear-gradient(180deg, rgba(31,27,22,0) 40%, rgba(31,27,22,0.7) 100%)` để chữ trắng đọc rõ.
- Luôn có `alt` mô tả bằng tiếng Việt; khi đang tải hiển thị nền stone-200.

---

## 7. Components

Mỗi component chỉ dùng role token. Trạng thái chuẩn: default, hover, active/pressed, focus-visible, disabled, loading (nếu có).

### 7.1 Button

| Variant | Nền | Chữ | Border | Hover |
|---|---|---|---|---|
| Primary | brandy-600 | white | none | brandy-700 |
| Secondary | transparent | pearl-900 | 1px pearl-900 | nền pearl-900, chữ cream-100 |
| Reed | reed-700 | white | none | tối hơn 8% |
| Ghost | transparent | brandy-600 | none | nền brandy-100 |
| Inverse (trên nền tối) | cream-100 | pearl-900 | none | gold-200 |
| Link | none | brandy-600, gạch chân khi hover | none | brandy-700 |
| Danger | danger | white | none | tối hơn 8% |

| Size | Cao | Padding ngang | Font |
|---|---|---|---|
| sm | 36px | 16px | 12px |
| md (mặc định) | 44px | 24px | 14px |
| lg | 52px | 32px | 14px |

- Chữ nút viết hoa, letter-spacing 0.08em, weight 600, radius 4px.
- Icon trong nút 16px, cách chữ 8px.
- Disabled: opacity 0.4, `cursor: not-allowed`.
- Loading: spinner 16px thay icon, giữ nguyên độ rộng nút.
- Focus: `box-shadow: var(--shadow-focus)`.

### 7.2 Form controls

**Input / Select / Textarea / Date picker**

- Cao 44px, padding 12px 16px, nền white, border 1px stone-300, radius 4px, font 14–16px.
- Label phía trên: 12px, weight 600, uppercase, letter-spacing 0.08em, màu stone-700, cách input 8px.
- Placeholder: stone-500.
- Hover: border stone-500. Focus: border brandy-600 + shadow-focus.
- Error: border danger, helper text 12px màu danger, icon cảnh báo bên trái helper.
- Disabled: nền stone-200, chữ stone-500.
- Trường bắt buộc: dấu `*` màu danger sau label.

**Checkbox / Radio / Switch:** 18px, tick màu white trên nền brandy-600; switch track 36×20, bật màu reed-700.

### 7.3 Booking bar (thanh tìm & đặt phòng)

Component nhận diện của trang khách, nổi trên hero hoặc ngay dưới hero.

- Nền white, radius 16px, shadow-lg, padding 8px.
- Gồm các ô: **Ngày nhận phòng**, **Ngày trả phòng**, **Khách** (người lớn / trẻ em), **Loại phòng** (tuỳ chọn), nút **Primary lg "KIỂM TRA PHÒNG"**.
- Mỗi ô: label eyebrow 12px + giá trị 16px weight 500; phân cách bằng divider dọc stone-300.
- Mobile: xếp dọc, nút full-width, có thể thu gọn thành nút "Đặt phòng" cố định dưới màn hình.

### 7.4 Room card

- Ảnh 4:3 phía trên (radius 8px top), hover zoom 1.04.
- Badge góc trên trái (ví dụ "Bán chạy", "-15%").
- Thân card padding 24px: tên phòng (H3 Cormorant), dòng thông tin 14px stone-700 kèm icon (diện tích m², số khách, loại giường), danh sách 3–4 tiện nghi dạng icon.
- Chân card: giá (Price style) + "/ đêm" 14px stone-700, nút Secondary sm "XEM CHI TIẾT" hoặc Primary sm "ĐẶT NGAY".
- Biến thể ngang (horizontal) dùng cho trang kết quả tìm kiếm trên desktop.

### 7.5 Section heading

```
EYEBROW (12px, uppercase, gold-500 hoặc brandy-600)
Tiêu đề H2 Cormorant
Đường kẻ 48×1px gold-500
Mô tả Body L, stone-700, max 60ch
```

Căn giữa cho trang marketing, căn trái cho trang nội bộ.

### 7.6 Navigation

- **Header khách:** logo (wordmark serif) bên trái, menu giữa (Trang chủ, Phòng, Tiện ích, Ưu đãi, Liên hệ) 14px uppercase, bên phải nút Primary sm "ĐẶT PHÒNG" và icon tài khoản. Link active có gạch chân 1px gold-500.
- **Sidebar nội bộ:** nền pearl-900, item 44px, icon 20px + chữ 14px màu cream-100 (opacity 0.72), item active nền pearl-800 + thanh trái 3px gold-500 + chữ opacity 1. Nhóm menu có eyebrow 11px stone-500.
- **Breadcrumb:** 12px, phân cách `/`, item cuối pearl-900.
- **Tabs:** chữ 14px weight 500, active có gạch dưới 2px brandy-600.
- **Pagination:** ô 36×36, active nền pearl-900 chữ cream-100.

### 7.7 Badge / Status chip

Pill, cao 24px, padding 0 10px, font 12px weight 600, có chấm tròn 6px phía trước.

**Trạng thái phòng (dùng thống nhất ở mọi màn hình):**

| Trạng thái | Nhãn | Màu chữ / chấm | Nền |
|---|---|---|---|
| AVAILABLE | Trống | success | success-bg |
| RESERVED | Đã đặt | info | info-bg |
| OCCUPIED | Đang ở | brandy-700 | brandy-100 |
| CLEANING | Đang dọn | warning | warning-bg |
| MAINTENANCE | Bảo trì | danger | danger-bg |
| OUT_OF_SERVICE | Ngừng sử dụng | stone-700 | stone-200 |

**Trạng thái đặt phòng / hoá đơn:** Chờ xác nhận (warning), Đã xác nhận (info), Đã nhận phòng (brandy), Hoàn tất / Đã thanh toán (success), Đã huỷ / Thất bại (danger), Hoàn tiền (stone).

### 7.8 Card nội bộ và Stat card

- Card: nền white, border 1px stone-300, radius 8px, padding 24px, không shadow (hover shadow-md nếu click được).
- Stat card: label eyebrow, số liệu 32px Cormorant 600, so sánh kỳ trước 12px (success / danger kèm mũi tên).

### 7.9 Data table

- Header: nền stone-200, chữ 12px uppercase weight 600 stone-700, cao 44px.
- Dòng: cao 52px, font 14px, border dưới stone-300, hover nền cream-50.
- Cột số và tiền căn phải; cột trạng thái dùng Badge; cột hành động cuối cùng dùng icon button 32px + menu "...".
- Thanh công cụ phía trên: ô tìm kiếm, bộ lọc (select), nút Primary "THÊM MỚI" bên phải.
- Empty state: icon 48px stone-500, tiêu đề H4, mô tả Body S, nút hành động.

### 7.10 Modal / Drawer

- Overlay `rgba(31,27,22,0.5)`; modal nền white, radius 8px, shadow-lg, rộng 480 / 640 / 880px.
- Header: tiêu đề H3 + nút đóng; footer căn phải: Secondary "HUỶ" + Primary hành động.
- Modal xác nhận xoá / huỷ dùng nút Danger.
- Drawer phải 480px cho form chi tiết (ví dụ xem chi tiết đặt phòng).

### 7.11 Toast / Alert

- Toast góc trên phải, rộng 360px, nền white, viền trái 4px màu ngữ nghĩa, icon + tiêu đề 14px 600 + mô tả 14px; tự tắt sau 5 giây.
- Alert inline: nền màu `*-bg`, chữ màu ngữ nghĩa, radius 4px, padding 12px 16px.

### 7.12 Khác

- **Testimonial:** dấu ngoặc kép lớn gold-500, trích dẫn Cormorant italic 24px, tên khách 14px 600, sao đánh giá gold-500.
- **Amenity item:** icon 32px trong vòng tròn viền gold-500, tên 16px 500, mô tả 14px.
- **Avatar:** 32 / 40 / 64px, pill, fallback chữ cái đầu trên nền brandy-100.
- **Skeleton:** nền stone-200 với hiệu ứng shimmer nhẹ.
- **Footer:** nền pearl-900, chữ cream-100, tiêu đề cột eyebrow gold-500, link opacity 0.72 hover 1.

---

## 8. Pattern theo màn hình HMS

| Nhóm màn hình | Không gian | Component chính |
|---|---|---|
| Trang chủ, giới thiệu, tiện ích | Khách | Hero + Booking bar, Section heading, Room card, Amenity, Testimonial, Footer |
| Tìm & đặt phòng, chi tiết phòng | Khách | Booking bar, bộ lọc, Room card ngang, gallery, tóm tắt đặt phòng (card sticky), stepper 3 bước |
| Thanh toán (VNPay), kết quả | Khách | Form, tóm tắt hoá đơn, Alert success/danger |
| Đăng nhập / đăng ký (Firebase Auth) | Khách | Layout 2 cột: ảnh trái, form phải; nút đăng nhập Google dạng Secondary |
| Tài khoản khách, lịch sử đặt phòng, phản hồi | Khách | Tabs, Data table rút gọn hoặc list card, Badge trạng thái |
| Lễ tân: check-in / check-out, sơ đồ phòng | Nội bộ | Sidebar, lưới ô phòng theo tầng (ô 96×72 có màu theo trạng thái phòng), Drawer chi tiết |
| Dịch vụ, sự cố, nhiệm vụ nhân viên | Nội bộ | Data table, Badge, Modal form, Tabs theo trạng thái |
| Cơ sở vật chất, bảo trì | Nội bộ | Data table, Badge MAINTENANCE, lịch |
| Báo cáo, dashboard quản lý | Nội bộ | Stat card, chart (màu chuỗi: brandy-600, reed-700, lake-600, gold-500, stone-500) |

---

## 9. Accessibility

- Đạt tối thiểu **WCAG 2.1 AA**: tương phản chữ ≥ 4.5:1 (đã kiểm tra ở mục 2.5).
- Vùng chạm tối thiểu 44×44px trên mobile.
- Luôn có focus-visible rõ ràng (`--shadow-focus`), không xoá outline mà không thay thế.
- Không truyền đạt trạng thái chỉ bằng màu: badge luôn có chữ, lỗi form luôn có thông báo.
- Form có `label` gắn với input, lỗi liên kết qua `aria-describedby`.
- Modal giữ focus bên trong, đóng bằng phím Esc.
- Thuộc tính `lang="vi"` trên thẻ `html`.

---

## 10. Cách dùng trong code

**CSS thuần / bất kỳ framework nào**

```html
<link rel="stylesheet" href="/design-system/tokens.css" />
```

```css
body {
  background: var(--color-bg);
  color: var(--color-text);
  font-family: var(--font-body);
  font-size: var(--text-base);
  line-height: var(--leading-normal);
}

.btn-primary {
  height: 44px;
  padding: 0 var(--space-6);
  background: var(--color-primary);
  color: var(--color-on-primary);
  border-radius: var(--radius-md);
  font: var(--weight-semibold) var(--text-sm)/1 var(--font-body);
  letter-spacing: var(--tracking-wide);
  text-transform: uppercase;
  transition: background var(--duration-fast) var(--ease-standard);
}
.btn-primary:hover { background: var(--color-primary-hover); }
.btn-primary:focus-visible { outline: none; box-shadow: var(--shadow-focus); }
```

**Tailwind**

```js
// tailwind.config.js
module.exports = {
  presets: [require('./design-system/tailwind.preset.js')],
  content: ['./src/**/*.{html,js,jsx,ts,tsx,vue}'],
};
```

```html
<button class="h-11 px-6 rounded bg-primary hover:bg-primary-hover text-white text-sm font-semibold uppercase tracking-wider">
  Đặt phòng
</button>
```

**Quy ước cho cả nhóm**

1. Không viết mã hex trực tiếp trong component; luôn dùng token.
2. Thêm hoặc đổi token thì sửa đồng thời `tokens.css`, `tokens.json`, `tailwind.preset.js` và cập nhật file này.
3. Component mới phải có đủ trạng thái hover, focus, disabled và kiểm tra trên mobile 375px.
