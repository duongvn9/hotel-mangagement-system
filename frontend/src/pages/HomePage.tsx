import { addDays, format } from 'date-fns'
import {
  ArrowRight,
  BedDouble,
  Car,
  Coffee,
  Flower2,
  MapPin,
  Moon,
  Plane,
  Star,
  Sunrise,
  Sunset,
  UtensilsCrossed,
  Waves,
} from 'lucide-react'
import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router'
import { isStaffRole } from '@/app/navigation'
import { guestImages } from '@/assets/guest'
import { Button } from '@/components/atoms'
import { PhotoTile, SectionHeading } from '@/components/molecules'
import { HeroBanner, SearchBar } from '@/components/organisms'
import { useAuth } from '@/features/auth/auth-context'
import { useAvailability } from '@/features/booking/hooks'
import { assetUrl } from '@/lib/asset-url'
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

const getTomorrow = () => format(addDays(new Date(), 1), 'yyyy-MM-dd')
const getDayAfter = () => format(addDays(new Date(), 2), 'yyyy-MM-dd')

const AMENITY_HIGHLIGHTS = [
  { icon: Waves, title: 'Hồ bơi vô cực', desc: 'Nước ấm, mở cửa 6:00–22:00' },
  { icon: Flower2, title: 'Spa đá', desc: 'Massage đặc trưng' },
  { icon: UtensilsCrossed, title: 'Bếp theo mùa', desc: 'Bữa sáng tại phòng hoặc sân hiên' },
  { icon: Car, title: 'Đưa đón sân bay', desc: 'Xe riêng theo yêu cầu' },
]

/** Trang chủ: hero, thanh tìm phòng nổi, các bước đặt phòng và lối vào theo vai trò. */
export function HomePage() {
  const { me } = useAuth()
  const navigate = useNavigate()
  const staff = me !== null && isStaffRole(me.role)

  const tomorrow = useMemo(() => getTomorrow(), [])
  const dayAfter = useMemo(() => getDayAfter(), [])

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
          <SectionHeading
            eyebrow="Khách sạn"
            title="Hai mươi bốn phòng, một nhịp sống thong thả."
            body={siteContent.intro}
          />
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
                            src={assetUrl(t.image)}
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
            <SectionHeading
              eyebrow="Một ngày tại Emily"
              title="Từ bình minh đến khi sao lên."
              body="Chúng tôi lo những điều nhỏ để bạn chỉ việc tận hưởng."
            />
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
                <span className="absolute -left-10 top-0 -translate-x-1/2 grid size-10 place-items-center rounded-full border bg-card text-primary">
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
        <SectionHeading title="Mọi thứ chu đáo, không chút vội vàng." />
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {AMENITY_HIGHLIGHTS.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="card-soft p-6">
              <Icon className="size-6 text-primary" />
              <div className="mt-6 font-semibold">{title}</div>
              <div className="text-sm text-muted-foreground">{desc}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-24 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.4fr] lg:gap-20">
          <SectionHeading
            eyebrow="Quy trình"
            title="Đặt phòng trong ba bước"
            body="Không cần tài khoản để tìm phòng. Đăng nhập khi bạn muốn theo dõi booking và gửi phản hồi sau kỳ nghỉ."
          />
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

      <section className="mx-auto max-w-7xl px-5 lg:px-8">
        <div className="grid gap-5 md:grid-cols-3">
          {siteContent.testimonials.map((t, index) => (
            <figure key={index} className="rounded-3xl bg-ink p-8 text-ink-foreground">
              <div
                role="img"
                aria-label={`${t.rating} trên 5 sao`}
                className="flex gap-0.5 text-lavender"
              >
                {Array.from({ length: t.rating }, (_, i) => (
                  <Star key={i} aria-hidden className="size-4 fill-current" />
                ))}
              </div>
              <blockquote className="font-display mt-5 text-2xl leading-snug">
                “{t.quote}”
              </blockquote>
              <figcaption className="mt-6 text-sm text-ink-foreground/60">{t.name}</figcaption>
            </figure>
          ))}
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

      <section className="mx-auto max-w-7xl px-5 py-28 text-center lg:px-8">
        <p className="text-sm font-medium tracking-[0.2em] text-primary uppercase">
          Đặt trực tiếp · Giá tốt nhất
        </p>
        <h2 className="font-display mx-auto mt-4 max-w-3xl text-6xl leading-[1.15]">
          Kỳ nghỉ tiếp theo của bạn bắt đầu từ đây.
        </h2>
        <p className="mx-auto mt-5 max-w-md text-muted-foreground">{siteContent.offer}</p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link
            to="/search"
            className="inline-flex items-center gap-2 rounded-full bg-ink px-7 py-3.5 text-sm font-medium text-ink-foreground transition hover:bg-primary"
          >
            Chọn phòng <ArrowRight className="size-4" />
          </Link>
          <Link
            to="/experiences"
            className="inline-flex items-center rounded-full border px-7 py-3.5 text-sm font-medium transition hover:bg-surface"
          >
            Khám phá trải nghiệm
          </Link>
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
    </>
  )
}
