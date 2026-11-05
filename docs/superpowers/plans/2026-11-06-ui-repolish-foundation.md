# UI repolish foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dựng nền móng để các task Jira migrate từng trang sang UI prototype: token mới, bộ component atomic design, bản copy prototype để tham chiếu, `DESIGN.md` mới và hướng dẫn repolish cho AI.

**Architecture:** Token prototype (oklch, shadcn-style) thành nguồn chuẩn trong `design-system/`; token cũ giữ lại ở `design-system/legacy.css` (Tailwind `@theme`) để trang chưa migrate không vỡ. Primitive shadcn vendor ở `frontend/src/components/ui/`; trang chỉ import từ `atoms | molecules | organisms | templates`. Prototype copy nguyên vào `ui-prototype/` (ngoài mọi tooling) làm tham chiếu chỉ đọc.

**Tech Stack:** React 19, Vite 8, react-router 8, Tailwind v4 (`@tailwindcss/vite`), Vitest 5 + Testing Library, radix-ui, class-variance-authority, lucide-react, sonner, react-day-picker, date-fns, recharts.

**Spec:** `docs/superpowers/specs/2026-11-06-ui-repolish-foundation-design.md`

## Global Constraints

- Prototype nguồn: <https://github.com/yunkhngn/stayflow-hotel-harmony>, commit `b6a0a602d5b12a4c505072ed2bd183153b1eea46`. Bản shallow clone đã có ở `/private/tmp/claude-501/-Volumes-Data-Code-study-hotel-mangagement-system/a2cd5aee-6a86-4fc0-8a44-367d37266e2a/scratchpad/proto` (gọi tắt `$PROTO`); nếu mất thì clone lại và `git checkout` đúng commit.
- Giữ react-router; không đổi API/hook/logic/test hành vi của feature; không restyle trang feature; không dark mode.
- Không mang mock data, zustand store, `RoleSwitcher`, `CrudPage`, TanStack Router vào app. Màn/nhãn "Proposed / Đề xuất UX" không triển khai.
- Code frontend theo Prettier của repo (`semi: false`, `singleQuote: true`, `printWidth: 100`, `trailingComma: all`), TS strict (`noUnusedLocals`, `verbatimModuleSyntax`, `erasableSyntaxOnly`): mọi file port từ prototype phải qua `npx prettier --write` và `npm run typecheck`. Không dùng `any`.
- Alias `@/` → `frontend/src`. Tiếng Việt cho văn bản UI và tài liệu.
- Chạy Node bằng `export PATH=/opt/homebrew/opt/node@26/bin:$PATH` (máy mặc định Node 22; dự án cần >=24). Mọi lệnh npm chạy trong `frontend/`.
- **Chỉ `git add <đường dẫn cụ thể>`, không bao giờ `git add -A` / `.`.** `docker-compose.yml` đang sửa dở và không thuộc task này; trước mỗi commit chạy `git diff --cached --name-only` và kiểm tra không có `docker-compose.yml`, `.env*`, `*firebase-adminsdk*`.
- Commit nhỏ, Conventional Commits, mỗi commit tự build/test được; cuối message có dòng `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Test baseline: ghi lại số test đang pass ở Task 1; không được giảm.
- Component mới không đụng `frontend/src/components/*.tsx` cũ (chỉ Task 10 thêm `@deprecated`).

## Review Focus

Các đầu vào/điều kiện spec ngầm đòi nhưng dễ bị bỏ sót (mỗi dòng đã có test ở task chủ):

1. Trang cũ vẫn có CSS sau khi đổi token: lớp `bg-pearl-900`, `text-stone-700`, `border-stone-300`, `bg-cream-100`, `max-w-container`, `font-body`, `tracking-widest`, `bg-success-bg`, `text-primary-hover` vẫn sinh ra trong CSS build — **Task 4**.
2. `StatusBadge` nhận trạng thái lạ/rỗng: hiển thị tông trung tính và nhãn đã làm đẹp, không crash — **Task 6**.
3. `DataTable` rỗng / đang tải / chuỗi rất dài / đổi bộ lọc khi đang ở trang 3: hiện `EmptyState` hoặc skeleton, về trang 1, không timer giả — **Task 8**.
4. `DateRangeField` khi `to <= from` hoặc ngày không hợp lệ: không ném lỗi, tự đẩy `to` thành `from + 1 ngày` — **Task 7**.
5. `WorkspaceLayout` ở đường dẫn lồng nhau (`/staff/rooms/123`) vẫn đánh dấu đúng mục active, và ngăn kéo mobile tự đóng khi chuyển trang — **Task 9**.
6. Prototype không lọt vào tsc/lint/vitest/Docker context — **Task 2**.

---

## File Structure

| Đường dẫn | Trách nhiệm |
|---|---|
| `ui-prototype/` | Bản copy prototype (chỉ đọc) + `README.md`. Không có `.git`, `node_modules`, `bun.lock`. |
| `design-system/tokens.css` | Chỉ `:root { --background … }` của prototype (nguồn chuẩn, dùng được ở HTML tĩnh). |
| `design-system/theme.css` | Tailwind v4: `@theme inline` ánh xạ token + `@utility` (`font-display`, `card-soft`, `no-scrollbar`, `hero-scrim`). |
| `design-system/legacy.css` | `@theme` alias cho màu/cỡ chữ cũ (deprecated, xóa khi hết trang cũ). |
| `design-system/preview.html` | Bảng màu/chữ/bo góc/bóng tĩnh dựa trên `tokens.css`. |
| `design-system/tokens.json`, `tailwind.preset.js`, `frontend/tailwind.config.js` | **Xóa** (không ai tiêu thụ ngoài tài liệu cũ). |
| `frontend/src/styles/index.css` | Import theo thứ tự `tailwindcss` → `theme.css` → `legacy.css`, base layer. |
| `frontend/src/styles/tokens.test.ts` | Test chống lệch token giữa `tokens.css` và prototype. |
| `frontend/src/lib/utils.ts` | `cn()`. |
| `frontend/src/lib/format.ts` | `vnd`, `fdate`, `fshort`, `label` (port từ prototype). |
| `frontend/src/components/ui/*.tsx` | Primitive shadcn vendor, 22 file (xem Task 5). Trang không import trực tiếp. |
| `frontend/src/components/atoms/` | Button, Input, Textarea, Label, Checkbox, Switch, RadioGroup, Slider, Toggle, Separator, Skeleton, Avatar (re-export) + `StatusBadge`, `Logo` (viết mới) + `index.ts`. |
| `frontend/src/components/molecules/` | Select, Tabs, Popover, Tooltip, DropdownMenu, Toaster (re-export) + `FormField`, `StatCard`, `EmptyState`, `KeyValue`, `Stars`, `DateRangeField` + `index.ts`. |
| `frontend/src/components/organisms/` | Dialog, Sheet, AlertDialog (re-export) + `PageHeader`, `Panel`, `DataTable`, `charts`, `SearchBar`, `Unauthorized` + `index.ts`. |
| `frontend/src/components/templates/` | `SiteLayout`, `WorkspaceLayout`, `AuthLayout` + `index.ts`. Thuần trình bày, chưa thay `layouts/` hiện có. |
| `DESIGN.md` | Viết lại theo prototype. |
| `docs/UI-REPOLISH-GUIDE.md`, `CLAUDE.md`, `AGENTS.md` | Hướng dẫn cho AI/dev; hai file gốc chỉ trỏ tới guide + DESIGN.md. |

> **Điều chỉnh so với spec:** spec §4-D đặt prototype ở `design-system/prototype/`. `docker-compose.yml` đồng bộ cả `./design-system` vào container dev và `Dockerfile` copy cả thư mục đó, nên prototype (1.7 MB ảnh + source) sẽ bị kéo theo. Plan đặt ở **`ui-prototype/` (gốc repo)** — nằm ngoài mọi tooling và Docker context mà không phải sửa `docker-compose.yml` đang chỉnh dở. Spec và các tài liệu khác dùng đường dẫn mới này.

---

### Task 1: Baseline và commit tài liệu thiết kế

**Files:**
- Commit: `docs/superpowers/specs/2026-11-06-ui-repolish-foundation-design.md`, `docs/superpowers/plans/2026-11-06-ui-repolish-foundation.md`
- Modify: spec §4-D, §5 (đường dẫn `design-system/prototype/` → `ui-prototype/`)

**Interfaces:** Produces: số test baseline (ghi vào mô tả commit).

- [ ] **Step 1:** Trong `frontend/`, chạy `npm ci` rồi `npm run typecheck && npm run lint && npm run format:check && npm test && npm run build`. Expected: tất cả xanh. Ghi số file/test pass ra khỏi `npm test` (dùng làm baseline). Nếu có bước đỏ sẵn từ trước, dừng và báo Khoa.
- [ ] **Step 2:** Sửa spec: thay mọi `design-system/prototype/` bằng `ui-prototype/`, thêm một dòng ở §4-D nêu lý do Docker sync.
- [ ] **Step 3:** Commit: `git add docs/superpowers/specs docs/superpowers/plans` → `docs: add UI repolish foundation spec and plan`.

---

### Task 2: Copy prototype vào `ui-prototype/`

**Files:**
- Create: `ui-prototype/**` (từ `$PROTO`), `ui-prototype/README.md`
- Modify: `frontend/Dockerfile.dockerignore` (thêm `ui-prototype` cho chắc)

**Interfaces:** Produces: `ui-prototype/src/styles.css` (nguồn token), `ui-prototype/src/routes/*.tsx`, `ui-prototype/src/components/**`, `ui-prototype/src/assets/*.jpg` — các task sau đọc/copy từ đây.

- [ ] **Step 1:** `rsync -a --exclude .git --exclude node_modules --exclude bun.lock --exclude bunfig.toml "$PROTO"/ ui-prototype/`. Giữ `AGENTS.md`, `package.json`, `src`, `public`, `components.json`.
- [ ] **Step 2:** Viết `ui-prototype/README.md` (tiếng Việt, ≤ 25 dòng): nguồn + commit `b6a0a60…`; "chỉ đọc, không sửa, không import từ app"; cách chạy để so sánh (`cd ui-prototype && bun install && bun run dev`, hoặc `npm install --legacy-peer-deps && npm run dev`); `AGENTS.md` trong thư mục này là của Lovable và **không áp dụng** cho repo; mô tả nhanh `src/routes/` (file-based, `app.*` là khu làm việc), `src/lib/nav.ts` (menu theo vai trò), `src/components/hms/` (component ứng dụng), `src/styles.css` (token).
- [ ] **Step 3:** Thêm `ui-prototype` vào `frontend/Dockerfile.dockerignore`.
- [ ] **Step 4 (kiểm chứng cô lập):** Trong `frontend/`: `npm run typecheck && npm run lint && npm run format:check && npm test`. Expected: xanh, số test = baseline (prototype không bị quét). `git status --short` chỉ thấy `ui-prototype/`, `frontend/Dockerfile.dockerignore` (và `docker-compose.yml` đã sửa sẵn, không add).
- [ ] **Step 5:** Commit: `git add ui-prototype frontend/Dockerfile.dockerignore` → `chore(design-system): add read-only UI prototype reference`.

---

### Task 3: Dependencies, `cn()`, `format`, font

**Files:**
- Modify: `frontend/package.json`, `frontend/package-lock.json`, `frontend/index.html`
- Create: `frontend/src/lib/utils.ts`, `frontend/src/lib/utils.test.ts`, `frontend/src/lib/format.ts`, `frontend/src/lib/format.test.ts`

**Interfaces:** Produces: `cn(...inputs: ClassValue[]): string`; `vnd(n: number): string`, `fdate(d: string): string`, `fshort(d: string): string`, `label(s: string): string` (hành vi y hệt `ui-prototype/src/lib/format.ts`).

- [ ] **Step 1:** Cài dependency: `npm install @radix-ui/react-alert-dialog @radix-ui/react-avatar @radix-ui/react-checkbox @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-label @radix-ui/react-popover @radix-ui/react-radio-group @radix-ui/react-select @radix-ui/react-separator @radix-ui/react-slider @radix-ui/react-slot @radix-ui/react-switch @radix-ui/react-tabs @radix-ui/react-toggle @radix-ui/react-tooltip class-variance-authority clsx tailwind-merge lucide-react sonner react-day-picker date-fns recharts tw-animate-css`. Chạy lại `npm run build` xanh. Commit riêng: `chore(frontend): add UI primitive dependencies` (chỉ `package.json` + `package-lock.json`).
- [ ] **Step 2 (test đỏ):** `utils.test.ts`: `cn('px-2', 'px-4')` bằng `'px-4'`; `cn('a', false && 'b', undefined, 'c')` bằng `'a c'`. `format.test.ts`: `vnd(1500000)` chứa `'1.500.000'` và kết thúc bằng `' ₫'`; `fdate('2026-11-06')` bằng `"06 thg 11, 2026"`; `fshort('2026-11-06')` bằng `'06/11'`; `label('CHECKED_IN')` bằng `'Đã nhận phòng'`; `label('SOMETHING_ELSE')` bằng `'Something else'`; `label('')` bằng `''`. Chạy `npx vitest run src/lib` → FAIL (module chưa có).
- [ ] **Step 3:** Port `utils.ts` (chép `ui-prototype/src/lib/utils.ts`) và `format.ts` (chép từ prototype; nếu `label('')` ném lỗi/khác `''` thì sửa để trả `''`). Prettier + typecheck. Chạy lại test → PASS.
- [ ] **Step 4:** Trong `frontend/index.html` thêm `preconnect` và link Google Fonts đúng chuỗi của `ui-prototype/src/routes/__root.tsx` dòng 66-68 (Be Vietnam Pro 400-700, Playfair Display, `display=swap`). Giữ nguyên `<title>`.
- [ ] **Step 5:** Commit: `feat(frontend): add cn and format helpers and web fonts`.

---

### Task 4: Token, theme và lớp tương thích

**Files:**
- Create: `design-system/tokens.css`, `design-system/theme.css`, `design-system/legacy.css`, `frontend/src/styles/tokens.test.ts`
- Modify: `frontend/src/styles/index.css`
- Delete: `design-system/tokens.json`, `design-system/tailwind.preset.js`, `frontend/tailwind.config.js`

**Interfaces:** Produces: lớp Tailwind theo token mới (`bg-background`, `text-foreground`, `bg-card`, `text-muted-foreground`, `bg-primary text-primary-foreground`, `bg-ink`, `text-ink-foreground`, `bg-surface`, `bg-lavender`, `text-success|warning|info|danger`, `border-border`, `ring-ring`, `font-display`, `card-soft`, `shadow-soft`, `shadow-lift`, `no-scrollbar`, `hero-scrim`, `rounded-sm…4xl`). Giữ các lớp cũ chạy được qua `legacy.css`.

- [ ] **Step 1 (test đỏ):** `tokens.test.ts` (dùng `fs.readFileSync`, `describe.skipIf(!existsSync(protoPath))`): tách khối `:root { … }` của `ui-prototype/src/styles.css` và của `design-system/tokens.css`, parse thành map `--tên → giá trị`; expect hai map bằng nhau (cùng khóa và giá trị, trừ khoảng trắng). Thêm test thứ hai: `tokens.css` chứa `--primary`, `--ink`, `--surface`, `--radius`. Chạy → FAIL (file chưa có).
- [ ] **Step 2:** Tạo `tokens.css` = nguyên khối `:root` từ `ui-prototype/src/styles.css` (dòng 83-129, kèm comment đầu file ghi nguồn). Chạy test → PASS.
- [ ] **Step 3:** Tạo `theme.css` = các phần còn lại của `ui-prototype/src/styles.css`: `@theme inline {…}` (font, radius, color, shadow-soft, shadow-lift) và 4 `@utility` (`font-display`, `card-soft`, `no-scrollbar`, `hero-scrim`) + keyframes/`animate-marquee`; bỏ `@import "tailwindcss"`, `@source`, `@custom-variant dark` (không làm dark mode); giữ `@import "tw-animate-css"` ở `index.css`.
- [ ] **Step 4:** Tạo `legacy.css` — một khối `@theme` (không `inline`), đầu file ghi `/* DEPRECATED: xóa khi trang cuối cùng migrate xong */`. Giá trị lấy từ `design-system/tailwind.preset.js` hiện tại (hex nguyên bản), tên phẳng: `--color-pearl-{700,800,900}`, `--color-brandy-{100,400,600,700}`, `--color-gold-{200,500}`, `--color-reed-{100,700}`, `--color-lake-{100,600}`, `--color-cream-{50,100}`, `--color-stone-{200,300,500,700}`, `--color-success-bg|warning-bg|danger-bg|info-bg`, `--color-primary-hover`, `--color-primary-soft`; `--font-body: "Be Vietnam Pro", system-ui, sans-serif`; `--text-5xl: 3.5rem`/`--text-5xl--line-height: 1.1`, `--text-6xl: 4.5rem`/`--text-6xl--line-height: 1.05`; `--tracking-widest: 0.2em`; `--container-container: 1200px`; `--shadow-focus: 0 0 0 3px rgba(201, 164, 106, 0.45)`. **Không** khai báo `primary`, `success|warning|danger|info` (DEFAULT), `border`, radius, `font-display` (đã có ở theme mới).
- [ ] **Step 5:** Viết lại `frontend/src/styles/index.css`: `@import 'tailwindcss'; @import 'tw-animate-css'; @import '../../../design-system/tokens.css'; @import '../../../design-system/theme.css'; @import '../../../design-system/legacy.css';` rồi `@layer base` giống prototype (`* { border-color: var(--color-border) }`, `body` nền/chữ/font/antialiased) và **giữ** `:focus-visible { outline: none; box-shadow: 0 0 0 3px color-mix(in oklab, var(--ring) 45%, transparent) }` cho phần tử tùy biến của trang cũ. Xóa `@config`, `tailwind.config.js`, `tokens.json`, `tailwind.preset.js`. Xóa `.font-display` lining-nums cũ (đã có `@utility font-display`).
- [ ] **Step 6 (kiểm chứng lớp tương thích):** `npm run build`; trong file CSS ở `dist/assets/*.css` grep lần lượt các selector: `.bg-pearl-900`, `.text-stone-700`, `.border-stone-300`, `.bg-cream-100`, `.max-w-container`, `.font-body`, `.tracking-widest`, `.bg-success-bg`, `.text-primary-hover`, `.bg-primary`, `.text-primary-foreground`, `.bg-ink`, `.card-soft`, `.font-display`, `.shadow-soft`. Expected: tất cả có mặt. Thiếu cái nào thì sửa `legacy.css`/`theme.css` cho đến khi đủ. Chạy `npm run typecheck && npm run lint && npm run format:check && npm test` xanh.
- [ ] **Step 7:** Commit tách 3: (a) `feat(design-system): add prototype tokens with drift test` (tokens.css + test); (b) `feat(design-system): add Tailwind theme mapping and legacy aliases` (theme.css, legacy.css); (c) `refactor(frontend): switch styles to prototype tokens` (index.css + các file xóa). Mỗi commit phải build được — nếu (a) hay (b) đứng riêng làm hỏng build thì gộp lại.

---

### Task 5: Primitive shadcn vendor

**Files:**
- Create: `frontend/src/components/ui/{alert-dialog,avatar,button,calendar,checkbox,dialog,dropdown-menu,input,label,popover,radio-group,select,separator,sheet,skeleton,slider,sonner,switch,tabs,textarea,toggle,tooltip}.tsx`, `frontend/src/components/ui/ui.test.tsx`

**Interfaces:** Produces: export giống hệt prototype (ví dụ `Button`, `buttonVariants`, `Dialog`, `DialogContent`…); import nội bộ `@/lib/utils` và `@/components/ui/button` hợp lệ. Task 6-9 chỉ import qua barrel, không import file này trực tiếp.

- [ ] **Step 1 (test đỏ):** `ui.test.tsx`: (1) render `<Button variant="outline" size="sm">Lưu</Button>` → role `button` tên `Lưu`, có class `h-8` hoặc theo size sm của prototype (đọc `ui-prototype/src/components/ui/button.tsx` để lấy giá trị thật); `disabled` thì `toBeDisabled()`; `asChild` render `<a>`. (2) `buttonVariants({ variant: 'destructive' })` chứa `bg-destructive`. (3) render `Dialog open` với `DialogTitle` → role `dialog` có tên. (4) render `Input` gõ chữ bằng `userEvent` → giá trị đổi. Chạy `npx vitest run src/components/ui` → FAIL.
- [ ] **Step 2:** Chép 22 file từ `ui-prototype/src/components/ui/`, sửa chỗ cần cho TS strict của app (bỏ `React.` namespace không import, `import type` theo `verbatimModuleSyntax`, bỏ `"use client"`). Prettier toàn thư mục. Nếu test cần polyfill jsdom cho radix (`ResizeObserver`, `hasPointerCapture`, `scrollIntoView`), thêm vào `frontend/src/test/setup.ts`.
- [ ] **Step 3:** `npm run typecheck && npm run lint && npx vitest run src/components/ui` → PASS. Cảnh báo `react/only-export-components` cho `buttonVariants` được phép (warn).
- [ ] **Step 4:** Commit: `feat(ui): vendor shadcn primitives from prototype`.

---

### Task 6: Atoms

**Files:**
- Create: `frontend/src/components/atoms/index.ts`, `frontend/src/components/atoms/StatusBadge.tsx`, `frontend/src/components/atoms/Logo.tsx`, `frontend/src/components/atoms/atoms.test.tsx`

**Interfaces:**
- Consumes: `@/components/ui/*`, `label()` từ `@/lib/format`, `cn()`.
- Produces: `atoms/index.ts` re-export `Button, buttonVariants, Input, Textarea, Label, Checkbox, Switch, RadioGroup, RadioGroupItem, Slider, Toggle, Separator, Skeleton, Avatar, AvatarFallback, AvatarImage` từ `ui/`; và
  - `StatusBadge({ status, className }: { status: string; className?: string }): JSX.Element` — port `hms/ui.tsx` (map `statusTone`, chấm tròn + nhãn `label(status)`).
  - `Logo({ light, to }: { light?: boolean; to?: string }): JSX.Element` — port từ `SiteLayout` (`Link` của react-router, mặc định `to="/"`).

- [ ] **Step 1 (test đỏ):** `atoms.test.tsx`: `StatusBadge status="CHECKED_IN"` hiển thị `Đã nhận phòng` và có class `text-info`; `CANCELLED` → `text-danger`; `PENDING_DEPOSIT` → `text-warning`; **trạng thái lạ** `status="WEIRD_STATE"` hiển thị `Weird state` với `text-muted-foreground` (không ném lỗi); `status=""` không ném lỗi. `Logo` bọc trong `MemoryRouter`: có link `href="/"`, chứa chữ `Emily Hotel`; `light` đổi sang `text-ink-foreground`. Barrel: `import { Button, Input } from '@/components/atoms'` là hàm/component hợp lệ. FAIL.
- [ ] **Step 2:** Viết hai component và barrel; `Logo` dùng `Link` từ `react-router`. Prettier, typecheck, test → PASS.
- [ ] **Step 3:** Commit: `feat(ui): add atoms (StatusBadge, Logo, primitive re-exports)`.

---

### Task 7: Molecules

**Files:**
- Create: `frontend/src/components/molecules/{index.ts,FormField.tsx,StatCard.tsx,EmptyState.tsx,KeyValue.tsx,Stars.tsx,DateRangeField.tsx,molecules.test.tsx}`

**Interfaces:**
- Consumes: atoms (`Label`, `Input`…), `ui/{select,tabs,popover,tooltip,dropdown-menu,sonner,calendar}`, `cn`, `date-fns`.
- Produces: `molecules/index.ts` re-export `Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Tabs, TabsList, TabsTrigger, TabsContent, Popover, PopoverTrigger, PopoverContent, Tooltip, TooltipProvider, TooltipTrigger, TooltipContent, DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, Toaster` và:
  - `FormField({ label, htmlFor, error, hint, required, children }: { label: string; htmlFor: string; error?: string; hint?: string; required?: boolean; children: ReactNode })` — nhãn + control + lỗi `role="alert"` (viết mới theo mẫu field trong `CrudPage`).
  - `StatCard({ label, value, hint, icon, trend })`, `EmptyState({ title, body, action, icon })`, `KeyValue({ k, v })` (port `KV`), `Stars({ value, onChange })` — port nguyên từ `hms/ui.tsx`.
  - `DateRangeField({ from, to, onChange, className }: { from: string; to: string; onChange: (from: string, to: string) => void; className?: string })` — port, `from/to` là `yyyy-MM-dd`.

- [ ] **Step 1 (test đỏ):** `FormField` có lỗi → `getByRole('alert')` chứa lỗi và label liên kết với input qua `htmlFor` (`getByLabelText`); `required` thêm dấu `*` có `aria-hidden`. `StatCard` hiển thị label/value/hint, có icon thì render. `EmptyState` có `title`, `body`, `action` (nút bấm được). `KeyValue` hiển thị cặp. `Stars value={3}`: đúng 3 sao `fill-primary`; không có `onChange` thì các nút `disabled`; có `onChange`, bấm sao 5 gọi `onChange(5)`. `DateRangeField from="2026-11-10" to="2026-11-12"` hiển thị `10/11` và `12/11` (định dạng `EEE, dd/MM` locale vi); **với `to <= from`** (`to="2026-11-10"`) không ném lỗi và vẫn render; chọn lại khoảng chỉ có `from` gọi `onChange(from, from + 1 ngày)` — kiểm bằng cách export hàm thuần `normalizeRange(from: Date, to?: Date): [string, string]` và test trực tiếp (`normalizeRange(new Date('2026-11-10'))` → `['2026-11-10', '2026-11-11']`; `to` nhỏ hơn hoặc bằng `from` cũng ra ngày kế tiếp). FAIL.
- [ ] **Step 2:** Triển khai; `normalizeRange` thay logic inline trong `onSelect` của prototype. Prettier, typecheck, test → PASS.
- [ ] **Step 3:** Commit: `feat(ui): add molecules (FormField, StatCard, EmptyState, DateRangeField…)`.

---

### Task 8: Organisms

**Files:**
- Create: `frontend/src/components/organisms/{index.ts,PageHeader.tsx,Panel.tsx,DataTable.tsx,charts.tsx,SearchBar.tsx,Unauthorized.tsx,organisms.test.tsx}`

**Interfaces:**
- Consumes: atoms, molecules (`EmptyState`, `Select*`, `DateRangeField`), `label`, `cn`.
- Produces: `organisms/index.ts` re-export `Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription, Sheet, SheetContent, AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle` và:
  - `PageHeader({ title, subtitle, actions, eyebrow })`, `Panel({ title, action, children, className })` — port nguyên.
  - `DataTable<T extends { id: string }>(props: { rows: T[]; columns: Column<T>[]; search?: (row: T) => string; filters?: Filter<T>[]; pageSize?: number; onRowClick?: (row: T) => void; toolbar?: ReactNode; empty?: ReactNode; loading?: boolean })` với `Column<T> = { key: string; header: string; render?: (row: T) => ReactNode; className?: string }`, `Filter<T> = { key: string; label: string; options: string[]; get: (row: T) => string }` (**`get` bắt buộc**, bỏ truy cập `(r as any)[key]`; ô mặc định hiển thị `String(row[key as keyof T] ?? '')`). Khác prototype: bỏ timer giả 350ms, thêm prop `loading`.
  - `charts.tsx`: `RevenueArea({ series }: { series: { d: string; revenue: number }[] })`, `SimpleBars({ data, k, color? })`, `Donut({ data: { name: string; value: number }[] })` (bỏ `revenueSeries`, `Data`, `day`, mock).
  - `SearchBar({ compact, initial, onSearch }: { compact?: boolean; initial?: { from: string; to: string; guests: number }; onSearch: (v: { from: string; to: string; guests: number }) => void })` — thay `useNavigate` bằng callback; ngày mặc định `initial` hoặc hôm nay+3/+6.
  - `Unauthorized({ homeTo }: { homeTo?: string })` — port, dùng `Link` react-router.

- [ ] **Step 1 (test đỏ):** `PageHeader` hiển thị `h1`, subtitle, actions, eyebrow. `Panel` có tiêu đề + nội dung. **`DataTable`**: (a) 3 dòng, hiện đủ cột/ô; (b) `rows=[]` → hiện `EmptyState` "Không có kết quả phù hợp", không có hàng dữ liệu; (c) `loading` → hiện skeleton, không hiện `empty`; (d) `pageSize=2` với 5 dòng: "Trang 1 / 3", bấm "Trang sau" → "Trang 2 / 3"; (e) đang ở trang 3 rồi gõ vào ô tìm kiếm → quay về "Trang 1"; (f) chuỗi ô dài 300 ký tự không làm test lỗi và ô nằm trong `overflow-x-auto`; (g) `onRowClick` được gọi với đúng dòng. `SearchBar`: bấm "Kiểm tra phòng trống" gọi `onSearch` với `{ from, to, guests: 2 }`. `Unauthorized` có link về `homeTo` mặc định `/`. Biểu đồ chỉ cần render không lỗi với dữ liệu rỗng (`series=[]`). FAIL.
- [ ] **Step 2:** Triển khai theo prototype (`ui-prototype/src/components/hms/{ui,DataTable,SearchBar,charts,Unauthorized}.tsx`). Giữ nguyên class để giống prototype. Prettier, typecheck, test → PASS.
- [ ] **Step 3:** Commit tách 2: `feat(ui): add PageHeader, Panel and DataTable organisms` rồi `feat(ui): add charts, SearchBar and Unauthorized organisms`.

---

### Task 9: Templates

**Files:**
- Create: `frontend/src/components/templates/{index.ts,SiteLayout.tsx,WorkspaceLayout.tsx,AuthLayout.tsx,templates.test.tsx}`, `frontend/src/assets/auth-suite.jpg` (copy `ui-prototype/src/assets/room-suite.jpg`)

**Interfaces:**
- Consumes: atoms (`Logo`, `Button`, `Avatar`, `Skeleton`), organisms (`Sheet*`, `Unauthorized`), molecules (`DropdownMenu*`), `react-router` (`Link`, `useLocation`, `Outlet`).
- Produces:
  - `NavItem = { to: string; label: string; icon: LucideIcon }`, `NavGroup = { title: string; items: NavItem[] }` (export từ `templates`).
  - `SiteLayout({ children, overlay, links, actions }: { children: ReactNode; overlay?: boolean; links: { to: string; label: string }[]; actions?: ReactNode })` — port header/footer của `hms/SiteLayout.tsx`; đã bỏ phụ thuộc store/role.
  - `WorkspaceLayout({ groups, user, workspaceLabel, onLogout, profileTo, publicSiteTo, loading, forbidden, children }: { groups: NavGroup[]; user: { name: string; roleLabel: string }; workspaceLabel: string; onLogout: () => void; profileTo?: string; publicSiteTo?: string; loading?: boolean; forbidden?: boolean; children?: ReactNode })` — port `routes/app.tsx` (sidebar `bg-ink` nhóm thu gọn được, header sticky, ngăn kéo `Sheet` trên mobile, menu người dùng); `children` mặc định `<Outlet />`; bỏ thông báo/RoleSwitcher/store.
  - `AuthLayout({ title, subtitle, children, image?, quote? }: …)` — port, `image` mặc định là `auth-suite.jpg`.
  - Hàm thuần `isNavActive(pathname: string, to: string): boolean` = `pathname === to || pathname.startsWith(to + '/')`.

- [ ] **Step 1 (test đỏ):** `isNavActive('/staff/rooms/123', '/staff/rooms')` true; `('/staff/rooms-extra', '/staff/rooms')` false; `('/staff', '/staff')` true. `WorkspaceLayout` trong `MemoryRouter initialEntries={['/staff/rooms/123']}` với nhóm có `/staff/rooms`: link "Phòng" có `aria-current="page"` (thêm thuộc tính này vào link active của template); tiêu đề nhóm chứa mục active tự mở (`aria-expanded="true"`), nhóm khác bấm thì đóng/mở; `forbidden` hiện `Unauthorized` thay `children`; `loading` hiện skeleton, không có sidebar link; bấm nút "Mở menu" mở ngăn kéo (role `dialog`), bấm một link trong ngăn kéo thì ngăn kéo đóng (gọi `onNavigate`); menu người dùng bấm "Đăng xuất" gọi `onLogout`. `SiteLayout`: render links, footer, `overlay` đổi class header sang `absolute`; nút menu mobile mở/đóng danh sách. `AuthLayout`: có `h1` title và subtitle. FAIL.
- [ ] **Step 2:** Triển khai; thay `activeProps` của TanStack bằng `useLocation()` + `cn()` (quy tắc trong `ui-prototype/AGENTS.md`: không ghép class kiểu `activeProps`). Prettier, typecheck, test → PASS.
- [ ] **Step 3:** Commit tách 2: `feat(ui): add SiteLayout and AuthLayout templates`, `feat(ui): add WorkspaceLayout template`.

---

### Task 10: Đánh dấu component cũ là deprecated

**Files:**
- Modify: `frontend/src/components/{Alert,Badge,Button,SelectField,TextAreaField,TextField,ConfirmationDialog}.tsx` (chỉ thêm JSDoc)

**Interfaces:** Produces: mỗi export công khai có `/** @deprecated Dùng <X> từ '@/components/<tầng>' (xem DESIGN.md). */`.

- [ ] **Step 1:** Thêm `@deprecated` kèm đích thay thế: `Button` → atoms `Button`; `Badge` → atoms `StatusBadge`; `TextField` → molecules `FormField` + atoms `Input`; `TextAreaField` → `FormField` + `Textarea`; `SelectField` → molecules `Select`; `Alert` → (chưa có tương đương; ghi "chờ bản mới theo prototype"); `ConfirmationDialog` → organisms `AlertDialog`. **Không** đổi code/hành vi; `AssetImage`, `ImagePicker`, `ImageLightbox`, `ApiStatus`, `LakeIllustration` giữ nguyên (không có tương đương).
- [ ] **Step 2:** `npm run typecheck && npm run lint && npm run format:check && npm test`; số test = baseline + test mới. Lint không thêm lỗi.
- [ ] **Step 3:** Commit: `refactor(ui): mark legacy components as deprecated`.

---

### Task 11: DESIGN.md mới và design-system

**Files:**
- Rewrite: `DESIGN.md`
- Create: `design-system/preview.html` (thay bản cũ)
- Modify: `README.md` (các dòng nhắc preset/tokens: mục stack dòng 69, cây thư mục dòng 101, dòng 137)

**Interfaces:** Consumes: token ở `design-system/tokens.css`, cấu trúc ở Task 5-9. Produces: nguồn tham chiếu mà `docs/UI-REPOLISH-GUIDE.md` trỏ tới.

- [ ] **Step 1:** Viết lại `DESIGN.md` (tiếng Việt, thay hoàn toàn bản Grand Emily) theo mục: 1 Nguyên tắc (lấy từ prototype: sang trọng tĩnh lặng, nền sáng ấm, `card-soft`, Playfair cho tiêu đề lớn); 2 Token màu (bảng mọi biến trong `tokens.css`: tên, vai trò, giá trị oklch; quy tắc "chỉ dùng lớp semantic: `bg-primary`, không hex"); 3 Typography (Be Vietnam Pro + Playfair, `font-display`, thang cỡ chữ prototype dùng thực tế — đọc từ code, không bịa); 4 Spacing & layout (`max-w-7xl`, `px-4 sm:px-8`, header 64/80px, sidebar `w-64`); 5 Radius/bóng/motion (`--radius: 0.875rem`, `shadow-soft/lift`); 6 Icon & ảnh (lucide `size-4/5`, ảnh trong `ui-prototype/src/assets`); 7 **Atomic design**: sơ đồ 5 tầng, quy tắc import (trang chỉ import `atoms|molecules|organisms|templates`; không import `components/ui/`; không import component cũ ở trang đã migrate), bảng catalog mọi component với props chính và ví dụ dùng; 8 Pattern theo màn hình (danh sách → `PageHeader` + `DataTable`; dashboard → `StatCard` + `Panel` + charts; form → `FormField`; xác nhận → `AlertDialog`; trống → `EmptyState`); 9 Accessibility (focus ring, `aria-*`, tương phản, tiếng Việt); 10 Lớp tương thích cũ (`legacy.css`, bảng map tên cũ → mới: `pearl-900`→`ink`, `cream-100`→`background`, `stone-300`→`border`, `stone-700`→`muted-foreground`, `brandy-*`/`primary-hover`→`primary`, `*-bg`→tông `success|warning|danger|info` + `bg-*/10`), cách xóa khi xong; 11 Cách làm việc (trỏ tới guide). Mọi ví dụ class trong tài liệu phải tồn tại thật trong `theme.css`.
- [ ] **Step 2:** `design-system/preview.html`: trang tĩnh nạp `tokens.css` + Google Fonts, hiển thị swatch của mọi biến màu (nền = biến), thang chữ, radius, shadow. Không cần Tailwind. Mở bằng trình duyệt thấy màu đúng (nếu không có trình duyệt, kiểm tra bằng cách đọc lại HTML và đối chiếu danh sách biến).
- [ ] **Step 3:** Sửa `README.md` ba dòng cho khớp ("token + `theme.css` từ `design-system/`", không còn "preset"); thêm một dòng trỏ `DESIGN.md` và `docs/UI-REPOLISH-GUIDE.md`.
- [ ] **Step 4:** Kiểm chứng: `grep -n "Grand Emily\|brandy\|Cormorant\|tailwind.preset\|tokens.json" DESIGN.md README.md` chỉ còn xuất hiện ở mục "Lớp tương thích cũ"/lịch sử. Commit tách 2: `docs(design-system): rewrite DESIGN.md for prototype UI` và `docs(design-system): refresh token preview and README references`.

---

### Task 12: Hướng dẫn repolish cho AI

**Files:**
- Create: `docs/UI-REPOLISH-GUIDE.md`, `CLAUDE.md`, `AGENTS.md`

**Interfaces:** Consumes: DESIGN.md, `ui-prototype/`, barrels. Produces: tài liệu mà mỗi task Jira UI sẽ dán/trỏ tới.

- [ ] **Step 1:** Lập bảng ánh xạ bằng cách đọc `ui-prototype/src/routes/*.tsx` + `ui-prototype/src/lib/nav.ts` và `frontend/src/features/*/routes.tsx` + `frontend/src/app/navigation.ts`: mỗi hàng gồm *file prototype → route app → trang/file app → vai trò → ghi chú*. Đánh dấu rõ màn `Proposed` (ví dụ `app.notifications`) là "không triển khai" và màn app không có trong prototype là "hỏi Khoa". Cột "Task Jira" để trống (nhóm điền theo từng task).
- [ ] **Step 2:** Viết `docs/UI-REPOLISH-GUIDE.md` (tiếng Việt, gọn): (1) mục đích + nguyên tắc "giống prototype"; (2) quy trình 6 bước cho một trang (đọc DESIGN.md → mở trang prototype + chạy prototype để xem → liệt kê component từ barrel, thiếu thì thêm đúng tầng kèm test → chỉ đổi trình bày, giữ hook/api/logic/test → so sánh 1440px và 375px → typecheck/lint/format:check/test/build); (3) định nghĩa "giống" (cấu trúc, token, chữ, khoảng cách, bo góc, bóng, icon lucide cùng tên, các trạng thái hover/focus/disabled/empty/loading/error); (4) bảng ánh xạ ở Step 1; (5) danh sách cấm (hardcode màu/px, tự viết Button/Badge/Input, import `components/ui/` hoặc component cũ ở trang đã migrate, sửa `ui-prototype/`, mang mock/store/TanStack, đổi hành vi hay test cho "đẹp"); (6) khi prototype thiếu state/màn: dừng và hỏi; (7) quy trình PR (nhánh theo task, commit nhỏ Conventional Commits, ảnh so sánh prototype/app desktop + mobile, checklist "giống prototype", ghi rõ chưa xem gì bằng mắt); (8) **prompt mẫu** trong khối code, có chỗ điền `{MÃ_TASK}`, `{ROUTE_APP}`, `{FILE_PROTOTYPE}`, bắt AI: đọc DESIGN.md + guide + file prototype trước, liệt kê khác biệt, sửa, tự đối chiếu checklist, báo cáo những gì chưa chắc.
- [ ] **Step 3:** `CLAUDE.md` và `AGENTS.md` (≤ 15 dòng mỗi file, nội dung giống nhau): đây là dự án HMS (backend NestJS, frontend React); khi làm việc UI **bắt buộc** đọc `DESIGN.md` và `docs/UI-REPOLISH-GUIDE.md`; `ui-prototype/` chỉ đọc; chỉ `git add` đường dẫn cụ thể; Node >= 24.
- [ ] **Step 4:** Kiểm chứng: mọi đường dẫn trong guide tồn tại (`for p in $(grep -oE '`(frontend|ui-prototype|docs|design-system)/[^`]+`' docs/UI-REPOLISH-GUIDE.md | tr -d '`'); do test -e "$p" || echo MISSING $p; done` → không in gì). Commit: `docs: add UI repolish guide and agent instructions`.

---

### Task 13: Kiểm chứng toàn nhánh

**Files:** không sửa file nguồn (chỉ sửa nếu phát hiện lỗi, mỗi lỗi một commit `fix(...)`).

- [ ] **Step 1:** Trong `frontend/`: `npm ci && npm run typecheck && npm run lint && npm run format:check && npm test && npm run build`. Expected: tất cả xanh; số test ≥ baseline (Task 1) + test mới.
- [ ] **Step 2:** Lặp lại grep selector ở Task 4 Step 6 trên bản build cuối. Expected: đủ.
- [ ] **Step 3:** `npm run dev` (nền), mở `/`, `/login`, một trang `/manager/...` trong trình duyệt: trang cũ render đúng bố cục, không lỗi console; font Be Vietnam Pro/Playfair tải được. Ghi lại những gì **chưa** kiểm bằng mắt (375px, dark).
- [ ] **Step 4:** `git log --oneline main..HEAD` kiểm commit nhỏ, đúng định dạng; `git diff main..HEAD --name-only | grep -E "docker-compose.yml|\.env|firebase-adminsdk"` → rỗng; `git status --short` chỉ còn `docker-compose.yml` đã sửa sẵn của Khoa.
- [ ] **Step 5:** Báo cáo cho Khoa: kết quả từng lệnh (kèm số test), danh sách commit, mục chưa xem bằng mắt, và hai việc theo sau cần task Jira riêng: **(a)** migrate `layouts/StaffLayout` + `PublicLayout` sang `templates/` (giữ logic auth, test hiện có); **(b)** xóa `design-system/legacy.css` và component cũ khi hết trang cũ. Không tạo PR/đổi Jira khi chưa được yêu cầu.
