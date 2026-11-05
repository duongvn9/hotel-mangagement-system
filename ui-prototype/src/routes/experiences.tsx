import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Check } from "lucide-react";
import { SiteLayout } from "@/components/hms/SiteLayout";
import { useStore } from "@/lib/store";
import { images } from "@/lib/mock";
import { vnd } from "@/lib/format";
import spa from "@/assets/spa.jpg";
import dining from "@/assets/dining.jpg";
import bay from "@/assets/bay.jpg";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/experiences")({
  head: () => ({ meta: [
    { title: "Trải nghiệm & dịch vụ — Emily Hotel" },
    { name: "description", content: "Spa, ẩm thực, đưa đón và dịch vụ tại phòng ở Emily Hotel." },
    { property: "og:title", content: "Trải nghiệm & dịch vụ — Emily Hotel" },
    { property: "og:description", content: "Spa, ẩm thực và dịch vụ tại phòng." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Experiences,
});

const stories = [
  { img: spa, w: 1200, h: 1504, tag: "Spa đá", title: "Chậm lại, trong lòng đá travertine.", body: "Bốn phòng trị liệu, bồn ngâm thảo mộc và liệu trình massage đặc trưng với tinh dầu sả chanh trồng tại vườn.", points: ["Mở cửa 9:00 – 21:00", "Liệu trình 60 – 120 phút", "Gói đôi cho cặp đôi"] },
  { img: dining, w: 1504, h: 1104, tag: "Ẩm thực", title: "Bếp theo mẻ lưới mỗi sáng.", body: "Đầu bếp đi chợ lúc bình minh. Thực đơn thay đổi theo những gì ngư dân mang về — nướng than, đơn giản, đậm vị biển.", points: ["Bữa sáng 6:30 – 10:30", "Bữa tối trên sân hiên", "Phục vụ tại phòng 24/7"] },
  { img: images.hero, w: 1920, h: 1088, tag: "Hồ bơi", title: "Mặt nước nối liền với vịnh.", body: "Hồ vô cực 25 mét nước ấm, ghế tắm nắng có mái che và quầy đồ uống phục vụ tận nơi.", points: ["Mở cửa 6:00 – 22:00", "Khăn & kem chống nắng miễn phí", "Khu riêng cho trẻ em"] },
];

function Experiences() {
  const services = useStore((s) => s.data.services).filter((s) => s.active);
  const amenities = useStore((s) => s.data.amenities);
  const cats = [...new Set(services.map((s) => s.category))];
  return (
    <SiteLayout>
      <section className="mx-auto max-w-7xl px-5 pb-16 pt-14 lg:px-8">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">Trải nghiệm</p>
        <div className="mt-4 grid gap-8 md:grid-cols-[1.4fr_1fr] md:items-end">
          <h1 className="font-display text-6xl leading-[1.12] md:text-7xl">Trải nghiệm được sắp đặt quanh bạn.</h1>
          <p className="max-w-sm text-muted-foreground">Từ liệu trình spa đến bữa tối bên biển — mọi thứ đều có thể đặt trước, hoặc chỉ cần nhắn cho lễ tân.</p>
        </div>
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          <img src={bay} alt="Vịnh Nha Trang" width={1920} height={1088} className="aspect-[4/5] w-full rounded-3xl object-cover md:col-span-2 md:aspect-auto md:h-[520px]" />
          <div className="grid gap-4">
            <img src={spa} alt="Spa" loading="lazy" width={1200} height={1504} className="h-[252px] w-full rounded-3xl object-cover" />
            <img src={dining} alt="Nhà hàng" loading="lazy" width={1504} height={1104} className="h-[252px] w-full rounded-3xl object-cover" />
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-28 px-5 py-20 lg:px-8">
        {stories.map((st, i) => (
          <article key={st.tag} className="grid gap-10 md:grid-cols-2 md:items-center">
            <div className={cn("overflow-hidden rounded-[2rem]", i % 2 === 1 && "md:order-2")}>
              <img src={st.img} alt={st.tag} loading="lazy" width={st.w} height={st.h} className="aspect-[4/5] w-full object-cover transition duration-700 hover:scale-105" />
            </div>
            <div className="md:px-8">
              <div className="flex items-center gap-3 text-sm text-primary"><span className="font-display text-3xl">0{i + 1}</span><span className="h-px w-10 bg-primary/40" /><span className="uppercase tracking-[0.2em]">{st.tag}</span></div>
              <h2 className="mt-5 font-display text-5xl leading-[1.15]">{st.title}</h2>
              <p className="mt-5 max-w-md text-muted-foreground">{st.body}</p>
              <ul className="mt-8 grid gap-3 border-t pt-6">
                {st.points.map((p) => <li key={p} className="flex items-center gap-3 text-sm"><Check className="size-4 text-primary" />{p}</li>)}
              </ul>
            </div>
          </article>
        ))}
      </section>

      <section className="bg-surface py-24">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">Có thể đặt khi lưu trú</p>
              <h2 className="mt-3 font-display text-5xl">Thực đơn dịch vụ</h2>
            </div>
            <p className="max-w-xs text-sm text-muted-foreground">Đặt qua khu khách hàng sau khi nhận phòng, chi phí cộng vào hoá đơn.</p>
          </div>
          <div className="mt-12 grid gap-10 md:grid-cols-2">
            {cats.map((c) => (
              <div key={c}>
                <div className="mb-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">{c}</div>
                <ul className="divide-y border-y">
                  {services.filter((s) => s.category === c).map((s) => (
                    <li key={s.id} className="flex items-baseline gap-3 py-4">
                      <span className="font-medium">{s.name}</span>
                      <span className="flex-1 border-b border-dotted border-muted-foreground/40" />
                      <span className="font-display text-xl">{vnd(s.price)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-24 lg:px-8">
        <div className="grid gap-10 md:grid-cols-[1fr_2fr]">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">Có trong mọi phòng</p>
            <h2 className="mt-3 font-display text-4xl leading-[1.2]">Những điều nhỏ, luôn sẵn sàng.</h2>
          </div>
          <div className="flex flex-wrap content-start gap-2">
            {amenities.map((a) => <span key={a.id} className="rounded-full border bg-card px-5 py-2.5 text-sm transition hover:border-primary hover:text-primary">{a.name}</span>)}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-24 lg:px-8">
        <div className="relative overflow-hidden rounded-[2rem] bg-ink p-12 text-ink-foreground md:p-16">
          <div aria-hidden className="absolute -right-20 -top-20 size-80 rounded-full bg-primary/40 blur-3xl" />
          <div className="relative grid gap-8 md:grid-cols-[1.5fr_1fr] md:items-end">
            <h2 className="font-display text-5xl leading-[1.15]">Đặt phòng hôm nay, nhận liệu trình spa 30 phút miễn phí.</h2>
            <div className="md:text-right">
              <Link to="/rooms" className="inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 text-sm font-medium text-primary-foreground transition hover:opacity-90">Xem phòng trống <ArrowRight className="size-4" /></Link>
            </div>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
