import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Waves, UtensilsCrossed, Flower2, Car, Star, MapPin, Plane, Sunrise, Coffee, Sunset, Moon } from "lucide-react";
import spa from "@/assets/spa.jpg";
import dining from "@/assets/dining.jpg";
import bay from "@/assets/bay.jpg";
import { SiteLayout } from "@/components/hms/SiteLayout";
import { SearchBar } from "@/components/hms/SearchBar";
import { useStore } from "@/lib/store";
import { images } from "@/lib/mock";
import { vnd } from "@/lib/format";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Emily Hotel — Khách sạn boutique bên vịnh Nha Trang" },
      { name: "description", content: "Đặt phòng và suite tại Emily Hotel: hướng biển, hướng vườn và sự sang trọng tĩnh lặng bên vịnh." },
      { property: "og:title", content: "Emily Hotel — Khách sạn boutique bên vịnh" },
      { property: "og:description", content: "Suite hướng biển, phòng hướng vườn và sự sang trọng tĩnh lặng bên vịnh." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function Home() {
  const types = useStore((s) => s.data.roomTypes);
  const fb = useStore((s) => s.data.feedback).filter((f) => f.rating >= 4).slice(0, 3);
  const guests = useStore((s) => s.data.guests);
  return (
    <SiteLayout overlay>
      <section className="relative h-[92vh] min-h-[640px] overflow-hidden">
        <img src={images.hero} alt="Hồ bơi vô cực của Emily Hotel lúc hoàng hôn" width={1920} height={1088} className="absolute inset-0 size-full object-cover" />
        <div className="hero-scrim absolute inset-0" />
        <div className="relative mx-auto flex h-full max-w-7xl flex-col justify-end px-5 pb-16 lg:px-8">
          <p className="mb-4 text-sm uppercase tracking-[0.25em] text-ink-foreground/80">Nha Trang · Từ năm 2014</p>
          <h1 className="max-w-3xl font-display text-6xl leading-[1.15] text-ink-foreground md:text-8xl">Nghỉ dưỡng nơi vịnh biển gặp ánh sáng.</h1>
          <div className="mt-10 max-w-4xl"><SearchBar /></div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-12 px-5 py-24 md:grid-cols-2 md:items-center lg:px-8">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">Khách sạn</p>
          <h2 className="mt-3 font-display text-5xl leading-[1.2]">Hai mươi bốn phòng, một nhịp sống thong thả.</h2>
          <p className="mt-5 max-w-md text-muted-foreground">Đá travertine, gỗ sồi và vải lanh. Spa tạc từ đá, căn bếp theo mùa chợ, và đội ngũ nhớ cả cách bạn uống cà phê.</p>
          <div className="mt-8 grid grid-cols-3 gap-6 border-t pt-6">
            {[["4.9", "Điểm đánh giá"], ["24", "Phòng & suite"], ["12'", "Đến sân bay"]].map(([v, l]) => (
              <div key={l}><div className="font-display text-4xl">{v}</div><div className="text-xs text-muted-foreground">{l}</div></div>
            ))}
          </div>
        </div>
        <img src={images.lobby} alt="Sảnh khách sạn và hồ spa" loading="lazy" width={1200} height={912} className="aspect-[4/3] w-full rounded-3xl object-cover" />
      </section>

      <section className="bg-surface py-24">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="flex items-end justify-between">
            <h2 className="font-display text-5xl">Phòng & suite</h2>
            <Link to="/rooms" className="hidden items-center gap-1 text-sm font-medium text-primary md:flex">Xem tất cả <ArrowRight className="size-4" /></Link>
          </div>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {types.map((t) => (
              <Link key={t.id} to="/rooms/$typeId" params={{ typeId: t.id }} className="group">
                <div className="overflow-hidden rounded-2xl"><img src={t.image} alt={t.name} loading="lazy" width={1200} height={912} className="aspect-[4/5] w-full object-cover transition duration-500 group-hover:scale-105" /></div>
                <div className="mt-4 flex items-start justify-between">
                  <div><div className="font-semibold">{t.name}</div><div className="text-sm text-muted-foreground">{t.size} m² · {t.bed}</div></div>
                  <div className="text-right text-sm"><div className="font-semibold">{vnd(t.price)}</div><div className="text-xs text-muted-foreground">/ đêm</div></div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>


      <section className="mx-auto max-w-7xl px-5 py-28 lg:px-8">
        <div className="grid gap-12 md:grid-cols-[1fr_1.2fr] md:items-start">
          <div className="md:sticky md:top-28">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">Một ngày tại Emily</p>
            <h2 className="mt-3 font-display text-5xl leading-[1.2]">Từ bình minh đến khi sao lên.</h2>
            <p className="mt-5 max-w-sm text-muted-foreground">Chúng tôi lo những điều nhỏ để bạn chỉ việc tận hưởng.</p>
          </div>
          <ol className="relative border-l pl-10">
            {[[Sunrise, "06:00", "Bơi buổi sớm", "Hồ vô cực vắng lặng, nước ấm và mặt vịnh còn phẳng lặng."], [Coffee, "08:30", "Bữa sáng trên sân hiên", "Bánh mì nướng củi, trái cây chợ Đầm và cà phê phin theo ý bạn."], [Flower2, "14:00", "Liệu trình spa đá", "90 phút massage tinh dầu sả chanh trong phòng travertine."], [Sunset, "17:45", "Hoàng hôn trên rooftop", "Cocktail đặc trưng khi mặt trời lặn sau dãy núi."], [Moon, "20:00", "Bữa tối hải sản", "Thực đơn theo mẻ lưới trong ngày, nấu trên bếp than."]].map(([I, time, t, d]: any) => (
              <li key={time} className="relative pb-12 last:pb-0">
                <span className="absolute -left-[3.05rem] grid size-10 place-items-center rounded-full border bg-card text-primary"><I className="size-4" /></span>
                <div className="font-display text-2xl text-primary">{time}</div>
                <div className="mt-1 text-xl font-semibold">{t}</div>
                <p className="mt-1 max-w-md text-sm text-muted-foreground">{d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-28 lg:px-8">
        <div className="grid auto-rows-[260px] gap-4 md:grid-cols-4">
          <figure className="group relative overflow-hidden rounded-3xl md:col-span-2 md:row-span-2">
            <img src={spa} alt="Phòng spa đá" loading="lazy" width={1200} height={1504} className="size-full object-cover transition duration-700 group-hover:scale-105" />
            <figcaption className="hero-scrim absolute inset-0 flex items-end p-8"><div className="text-ink-foreground"><div className="text-xs uppercase tracking-[0.2em] opacity-80">Spa</div><div className="font-display text-4xl">Tĩnh lặng trong đá</div></div></figcaption>
          </figure>
          <figure className="group relative overflow-hidden rounded-3xl md:col-span-2">
            <img src={dining} alt="Nhà hàng sân hiên" loading="lazy" width={1504} height={1104} className="size-full object-cover transition duration-700 group-hover:scale-105" />
            <figcaption className="hero-scrim absolute inset-0 flex items-end p-6"><div className="font-display text-3xl text-ink-foreground">Bếp theo mùa</div></figcaption>
          </figure>
          <div className="flex flex-col justify-between rounded-3xl bg-primary p-6 text-primary-foreground">
            <Star className="size-6" />
            <div><div className="font-display text-5xl">4.9</div><div className="text-sm opacity-80">trên 1.200 đánh giá</div></div>
          </div>
          <figure className="group relative overflow-hidden rounded-3xl">
            <img src={images.lobby} alt="Sảnh" loading="lazy" className="size-full object-cover transition duration-700 group-hover:scale-105" />
          </figure>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-5 py-24 lg:px-8">
        <h2 className="max-w-xl font-display text-5xl">Mọi thứ chu đáo, không chút vội vàng.</h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[[Waves, "Hồ bơi vô cực", "Nước ấm, mở cửa 6:00–22:00"], [Flower2, "Spa đá", "Massage đặc trưng"], [UtensilsCrossed, "Bếp theo mùa", "Bữa sáng tại phòng hoặc sân hiên"], [Car, "Đưa đón sân bay", "Xe riêng theo yêu cầu"]].map(([I, t, d]: any) => (
            <div key={t} className="card-soft p-6"><I className="size-6 text-primary" /><div className="mt-6 font-semibold">{t}</div><div className="text-sm text-muted-foreground">{d}</div></div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 lg:px-8">
        <div className="grid gap-5 md:grid-cols-3">
          {fb.map((f) => (
            <figure key={f.id} className="rounded-3xl bg-ink p-8 text-ink-foreground">
              <div className="flex gap-0.5 text-lavender">{Array.from({ length: f.rating }, (_, i) => <Star key={i} className="size-4 fill-current" />)}</div>
              <blockquote className="mt-5 font-display text-2xl leading-snug">“{f.comment}”</blockquote>
              <figcaption className="mt-6 text-sm text-ink-foreground/60">{guests.find((g) => g.id === f.guestId)?.name}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="relative mt-28 h-[80vh] min-h-[560px] overflow-hidden">
        <img src={bay} alt="Vịnh Nha Trang lúc hoàng hôn" loading="lazy" width={1920} height={1088} className="absolute inset-0 size-full object-cover" />
        <div className="hero-scrim absolute inset-0" />
        <div className="relative mx-auto flex h-full max-w-7xl flex-col justify-end px-5 pb-16 text-ink-foreground lg:px-8">
          <p className="text-sm uppercase tracking-[0.25em] opacity-80">Vị trí</p>
          <h2 className="mt-3 max-w-2xl font-display text-6xl leading-[1.15]">Giữa vịnh đẹp nhất Việt Nam.</h2>
          <div className="mt-10 grid max-w-3xl gap-6 border-t border-ink-foreground/20 pt-6 sm:grid-cols-3">
            {[[Plane, "35 phút", "Sân bay Cam Ranh"], [Waves, "2 phút", "Bãi biển Trần Phú"], [MapPin, "10 phút", "Tháp Bà Ponagar"]].map(([I, v, l]: any) => (
              <div key={l} className="flex items-center gap-3"><I className="size-5 opacity-80" /><div><div className="font-display text-2xl">{v}</div><div className="text-xs opacity-70">{l}</div></div></div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-28 text-center lg:px-8">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">Đặt trực tiếp · Giá tốt nhất</p>
        <h2 className="mx-auto mt-4 max-w-3xl font-display text-6xl leading-[1.15]">Kỳ nghỉ tiếp theo của bạn bắt đầu từ đây.</h2>
        <p className="mx-auto mt-5 max-w-md text-muted-foreground">Miễn phí huỷ trước 48 giờ, bữa sáng và đưa đón sân bay cho mọi đặt phòng trực tiếp.</p>
        <div className="mt-10 flex justify-center gap-3">
          <Link to="/rooms" className="inline-flex items-center gap-2 rounded-full bg-ink px-7 py-3.5 text-sm font-medium text-ink-foreground transition hover:bg-primary">Chọn phòng <ArrowRight className="size-4" /></Link>
          <Link to="/experiences" className="inline-flex items-center rounded-full border px-7 py-3.5 text-sm font-medium transition hover:bg-surface">Khám phá trải nghiệm</Link>
        </div>
      </section>
    </SiteLayout>
  );
}
