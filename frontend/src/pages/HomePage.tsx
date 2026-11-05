import { addDays, format } from 'date-fns'
import {
  ArrowRight,
  BedDouble,
  Coffee,
  Flower2,
  MapPin,
  Moon,
  Plane,
  Sunrise,
  Sunset,
  Waves,
} from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { isStaffRole, roleHome } from '@/app/navigation'
import { guestImages } from '@/assets/guest'
import { ApiStatus } from '@/components/ApiStatus'
import { Button } from '@/components/atoms'
import { PhotoTile } from '@/components/molecules'
import { HeroBanner, SearchBar } from '@/components/organisms'
import { ROLE_LABELS } from '@/features/auth/api'
import { useAuth } from '@/features/auth/auth-context'
import { useAvailability } from '@/features/booking/hooks'
import { vnd } from '@/lib/format'
import { siteContent } from '@/lib/site-content'
import { featuredRoomTypes } from './home/featured'

const STEPS = [
  {
    title: 'Chọn ngày và phòng',
    text: 'Nhập ngày nhận, ngày trả và số khách để xem các phòng còn trống, rồi chọn một hoặc nhiều phòng.',
  },
  {
    title: 'Đặt cọc qua VNPay',
    text: 'Hệ thống giữ phòng 15 phút để bạn đặt cọc an toàn qua VNPay, không cần chuyển khoản thủ công.',
  },
  {
    title: 'Nhận phòng tại quầy',
    text: 'Mang mã booking đến quầy lễ tân để nhận phòng. Phần còn lại thanh toán khi trả phòng.',
  },
]

/** Trang chủ: hero, thanh tìm phòng nổi, các bước đặt phòng và lối vào theo vai trò. */
export function HomePage() {
  const { me } = useAuth()
  const navigate = useNavigate()
  const staff = me !== null && isStaffRole(me.role)

  const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd')
  const dayAfter = format(addDays(new Date(), 2), 'yyyy-MM-dd')

  const {
    data: availableRooms,
    isPending,
    isError,
  } = useAvailability({
    checkIn: tomorrow,
    checkOut: dayAfter,
    guests: 2,
  })

  const featured = featuredRoomTypes(availableRooms ?? [])

  return (
    <>
      {staff && me && (
        <div className="border-b border-border bg-primary/10">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm text-foreground">
            <p>Bạn đang đăng nhập với vai trò {ROLE_LABELS[me.role] ?? me.role}.</p>
            <Link
              to={roleHome(me.role)}
              className="inline-flex min-h-11 items-center font-semibold text-primary hover:text-primary/80"
            >
              Vào khu làm việc <ArrowRight className="ml-1 size-4" />
            </Link>
          </div>
        </div>
      )}

      <HeroBanner
        image={guestImages.hero}
        imageAlt="Hồ bơi vô cực của Emily Hotel lúc hoàng hôn"
        title="Nghỉ dưỡng nơi vịnh biển gặp ánh sáng."
        eyebrow="Nha Trang · Từ năm 2014"
        tall
      >
        <SearchBar
          onSearch={({ from, to, guests }) =>
            navigate(`/search?checkIn=${from}&checkOut=${to}&guests=${guests}`)
          }
        />
      </HeroBanner>

      <section className="mx-auto grid max-w-7xl gap-12 px-5 py-24 md:grid-cols-2 md:items-center lg:px-8">
        <div>
          <p className="text-sm font-medium tracking-[0.2em] text-primary uppercase">Khách sạn</p>
          <h2 className="font-display mt-3 text-5xl leading-[1.2]">
            Hai mươi bốn phòng, một nhịp sống thong thả.
          </h2>
          <p className="mt-5 max-w-md text-muted-foreground">{siteContent.intro}</p>
          <div className="mt-8 grid grid-cols-3 gap-6 border-t pt-6">
            <div>
              <div className="font-display text-4xl">4.9</div>
              <div className="text-xs text-muted-foreground">Điểm đánh giá</div>
            </div>
            <div>
              <div className="font-display text-4xl">{siteContent.roomCount}</div>
              <div className="text-xs text-muted-foreground">Phòng & suite</div>
            </div>
            <div>
              <div className="font-display text-4xl">12'</div>
              <div className="text-xs text-muted-foreground">Đến sân bay</div>
            </div>
          </div>
        </div>
        <PhotoTile src={guestImages.lobby} alt="Sảnh khách sạn và hồ spa" aspect="4/3" />
      </section>

      {!isError && (isPending || featured.length > 0) && (
        <section className="bg-surface py-24">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <div className="flex items-end justify-between">
              <h2 className="font-display text-5xl">Phòng & suite</h2>
              <Link
                to="/search"
                className="hidden items-center gap-1 text-sm font-medium text-primary md:flex"
              >
                Xem tất cả <ArrowRight className="size-4" />
              </Link>
            </div>
            {isPending ? (
              <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="card-soft overflow-hidden p-4">
                    <div className="aspect-[4/3] w-full animate-pulse rounded-2xl bg-muted" />
                    <div className="mt-4 h-6 w-3/4 animate-pulse rounded bg-muted" />
                    <div className="mt-2 h-4 w-1/2 animate-pulse rounded bg-muted" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {featured.map((t) => (
                  <Link
                    key={t.roomTypeId}
                    to={`/room-types/${t.roomTypeId}?checkIn=${tomorrow}&checkOut=${dayAfter}&guests=2`}
                    className="group block"
                  >
                    <div className="card-soft overflow-hidden transition duration-300 group-hover:shadow-lift">
                      <div className="aspect-[4/3] w-full overflow-hidden bg-surface">
                        {t.image ? (
                          <img
                            src={t.image}
                            alt={t.name}
                            loading="lazy"
                            className="size-full object-cover transition duration-500 group-hover:scale-105"
                          />
                        ) : (
                          <div className="flex size-full items-center justify-center text-muted-foreground">
                            <BedDouble className="size-10 opacity-30" />
                          </div>
                        )}
                      </div>
                      <div className="p-5">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="font-display text-2xl font-semibold">{t.name}</h3>
                            <div className="mt-1 text-xs text-muted-foreground">
                              Còn {t.freeCount} phòng
                            </div>
                          </div>
                          {t.price !== undefined && (
                            <div className="text-right">
                              <div className="font-semibold">{vnd(t.price)}</div>
                              <div className="text-xs text-muted-foreground">/ đêm</div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      <section className="mx-auto max-w-7xl px-5 py-28 lg:px-8">
        <div className="grid gap-12 md:grid-cols-[1fr_1.2fr] md:items-start">
          <div className="md:sticky md:top-28">
            <p className="text-sm font-medium tracking-[0.2em] text-primary uppercase">
              Một ngày tại Emily
            </p>
            <h2 className="font-display mt-3 text-5xl leading-[1.2]">
              Từ bình minh đến khi sao lên.
            </h2>
            <p className="mt-5 max-w-sm text-muted-foreground">
              Chúng tôi lo những điều nhỏ để bạn chỉ việc tận hưởng.
            </p>
          </div>
          <ol className="relative border-l pl-10">
            {[
              {
                icon: Sunrise,
                time: '06:00',
                title: 'Bơi buổi sớm',
                desc: 'Hồ vô cực vắng lặng, nước ấm và mặt vịnh còn phẳng lặng.',
              },
              {
                icon: Coffee,
                time: '08:30',
                title: 'Bữa sáng trên sân hiên',
                desc: 'Bánh mì nướng củi, trái cây chợ Đầm và cà phê phin theo ý bạn.',
              },
              {
                icon: Flower2,
                time: '14:00',
                title: 'Liệu trình spa đá',
                desc: '90 phút massage tinh dầu sả chanh trong phòng travertine.',
              },
              {
                icon: Sunset,
                time: '17:45',
                title: 'Hoàng hôn trên rooftop',
                desc: 'Cocktail đặc trưng khi mặt trời lặn sau dãy núi.',
              },
              {
                icon: Moon,
                time: '20:00',
                title: 'Bữa tối hải sản',
                desc: 'Thực đơn theo mẻ lưới trong ngày, nấu trên bếp than.',
              },
            ].map(({ icon: Icon, time, title, desc }) => (
              <li key={time} className="relative pb-12 last:pb-0">
                <span className="absolute -left-[3.05rem] grid size-10 place-items-center rounded-full border bg-card text-primary">
                  <Icon className="size-4" />
                </span>
                <div className="font-display text-2xl text-primary">{time}</div>
                <div className="mt-1 text-xl font-semibold">{title}</div>
                <p className="mt-1 max-w-md text-sm text-muted-foreground">{desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-28 lg:px-8">
        <div className="grid auto-rows-[260px] gap-4 md:grid-cols-4">
          <figure className="group relative overflow-hidden rounded-3xl md:col-span-2 md:row-span-2">
            <img
              src={guestImages.spa}
              alt="Phòng spa đá"
              loading="lazy"
              className="size-full object-cover transition duration-700 group-hover:scale-105"
            />
            <figcaption className="hero-scrim absolute inset-0 flex items-end p-8">
              <div className="text-ink-foreground">
                <div className="text-xs tracking-[0.2em] uppercase opacity-80">Spa</div>
                <div className="font-display text-4xl">Tĩnh lặng trong đá</div>
              </div>
            </figcaption>
          </figure>
          <figure className="group relative overflow-hidden rounded-3xl md:col-span-2">
            <img
              src={guestImages.dining}
              alt="Nhà hàng sân hiên"
              loading="lazy"
              className="size-full object-cover transition duration-700 group-hover:scale-105"
            />
            <figcaption className="hero-scrim absolute inset-0 flex items-end p-6">
              <div className="font-display text-3xl text-ink-foreground">Bếp theo mùa</div>
            </figcaption>
          </figure>
          <div className="flex flex-col justify-between rounded-3xl bg-primary p-6 text-primary-foreground">
            <Waves className="size-6" />
            <div>
              <div className="font-display text-5xl">4.9</div>
              <div className="text-sm opacity-80">trên 1.200 đánh giá</div>
            </div>
          </div>
          <figure className="group relative overflow-hidden rounded-3xl">
            <img
              src={guestImages.lobby}
              alt="Sảnh"
              loading="lazy"
              className="size-full object-cover transition duration-700 group-hover:scale-105"
            />
          </figure>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-24 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.4fr] lg:gap-20">
          <div>
            <p className="text-sm font-medium tracking-[0.2em] text-primary uppercase">Quy trình</p>
            <h2 className="font-display mt-3 text-5xl leading-[1.2]">Đặt phòng trong ba bước</h2>
            <p className="mt-4 max-w-md text-muted-foreground">
              Không cần tài khoản để tìm phòng. Đăng nhập khi bạn muốn theo dõi booking và gửi phản
              hồi sau kỳ nghỉ.
            </p>
          </div>
          <ol aria-label="Các bước đặt phòng" className="border-b">
            {STEPS.map((step, index) => (
              <li key={step.title} className="grid grid-cols-[4rem_1fr] gap-6 border-t py-6">
                <span
                  aria-hidden
                  className="font-display text-5xl font-semibold text-primary lining-nums"
                >
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div>
                  <h3 className="font-display text-2xl font-semibold">{step.title}</h3>
                  <p className="mt-2 text-muted-foreground">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="relative mt-28 h-[80vh] min-h-[560px] overflow-hidden">
        <img
          src={guestImages.bay}
          alt="Vịnh Nha Trang lúc hoàng hôn"
          loading="lazy"
          className="absolute inset-0 size-full object-cover"
        />
        <div className="hero-scrim absolute inset-0" />
        <div className="relative mx-auto flex h-full max-w-7xl flex-col justify-end px-5 pb-16 text-ink-foreground lg:px-8">
          <p className="text-sm tracking-[0.25em] uppercase opacity-80">Vị trí</p>
          <h2 className="font-display mt-3 max-w-2xl text-6xl leading-[1.15]">
            Giữa vịnh đẹp nhất Việt Nam.
          </h2>
          <div className="mt-10 grid max-w-3xl gap-6 border-t border-ink-foreground/20 pt-6 sm:grid-cols-3">
            {[
              { icon: Plane, val: '35 phút', label: 'Sân bay Cam Ranh' },
              { icon: Waves, val: '2 phút', label: 'Bãi biển Trần Phú' },
              { icon: MapPin, val: '10 phút', label: 'Tháp Bà Ponagar' },
            ].map(({ icon: Icon, val, label }) => (
              <div key={label} className="flex items-center gap-3">
                <Icon className="size-5 opacity-80" />
                <div>
                  <div className="font-display text-2xl">{val}</div>
                  <div className="text-xs opacity-70">{label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {!staff && (
        <section className="border-t bg-surface">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-6 px-5 py-16 lg:px-8">
            <div>
              <h2 className="font-display text-3xl font-semibold">
                {me ? 'Tiếp tục kỳ nghỉ của bạn' : 'Đã có tài khoản?'}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {me
                  ? 'Xem lại chi tiết đặt phòng hoặc chia sẻ cảm nhận sau kỳ nghỉ.'
                  : 'Đăng nhập để theo dõi lịch sử đặt phòng và nhận các đặc quyền riêng.'}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              {me ? (
                <>
                  <Button asChild className="rounded-full px-6">
                    <Link to="/my-bookings">Booking của tôi</Link>
                  </Button>
                  <Button asChild variant="outline" className="rounded-full px-6">
                    <Link to="/my-feedback">Phản hồi của tôi</Link>
                  </Button>
                </>
              ) : (
                <>
                  <Button asChild className="rounded-full px-6">
                    <Link to="/login">Đăng nhập</Link>
                  </Button>
                  <Button asChild variant="outline" className="rounded-full px-6">
                    <Link to="/register">Đăng ký</Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </section>
      )}

      {import.meta.env.DEV && (
        <div className="mx-auto max-w-7xl px-5 pb-10 lg:px-8">
          <ApiStatus />
        </div>
      )}
    </>
  )
}
