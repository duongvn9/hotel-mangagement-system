import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { Check, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteLayout } from "@/components/hms/SiteLayout";
import { DateRangeField } from "@/components/hms/DateRangeField";
import { KV } from "@/components/hms/ui";
import { useStore, freeRooms } from "@/lib/store";
import { day, images, nights, roomTypes } from "@/lib/mock";
import { vnd } from "@/lib/format";

export const Route = createFileRoute("/rooms/$typeId")({
  validateSearch: (s: Record<string, unknown>): { from?: string; to?: string; guests?: number } => ({ from: (s.from as string) || undefined, to: (s.to as string) || undefined, guests: Number(s.guests) || undefined }),
  loader: ({ params }) => { const t = roomTypes.find((x) => x.id === params.typeId); if (!t) throw notFound(); return { name: t.name, description: t.description }; },
  head: ({ loaderData }) => ({ meta: [
    { title: `${loaderData?.name ?? "Phòng"} — Emily Hotel` },
    { name: "description", content: loaderData?.description ?? "Chi tiết phòng" },
    { property: "og:title", content: `${loaderData?.name ?? "Phòng"} — Emily Hotel` },
    { property: "og:description", content: loaderData?.description ?? "Chi tiết phòng" },
  ] }),
  component: RoomDetail,
});

function RoomDetail() {
  const { typeId } = Route.useParams();
  const sp = Route.useSearch();
  const s = { from: sp.from ?? day(3), to: sp.to ?? day(6), guests: sp.guests ?? 2 };
  const data = useStore((st) => st.data);
  const t = data.roomTypes.find((x) => x.id === typeId)!;
  const [from, setFrom] = useState(s.from);
  const [to, setTo] = useState(s.to);
  const [img, setImg] = useState(t.image);
  const n = nights(from, to);
  const free = freeRooms(data, t.id, from, to).length;
  const gallery = [t.image, images.lobby, images.hero, ...data.roomTypes.filter((x) => x.id !== t.id).map((x) => x.image).slice(0, 1)];

  return (
    <SiteLayout>
      <div className="mx-auto max-w-7xl px-5 py-8 lg:px-8">
        <Link to="/rooms" search={s} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ChevronLeft className="size-4" />Tất cả phòng</Link>
        <h1 className="mt-4 font-display text-6xl">{t.name}</h1>
        <p className="mt-2 text-muted-foreground">{t.size} m² · {t.bed} · Tối đa {t.capacity} khách</p>
        <div className="mt-8 grid gap-3 md:grid-cols-[1fr_180px]">
          <img src={img} alt={t.name} width={1200} height={912} className="aspect-[16/10] w-full rounded-3xl object-cover" />
          <div className="grid grid-cols-4 gap-3 md:grid-cols-1">
            {gallery.map((g, i) => <button key={i} onClick={() => setImg(g)} className={`overflow-hidden rounded-2xl ring-2 ${img === g ? "ring-primary" : "ring-transparent"}`}><img src={g} alt="" loading="lazy" className="aspect-square w-full object-cover md:aspect-[4/3]" /></button>)}
          </div>
        </div>
        <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_380px]">
          <div>
            <h2 className="text-lg font-semibold">Về phòng này</h2>
            <p className="mt-2 text-muted-foreground">{t.description}</p>
            <h2 className="mt-8 text-lg font-semibold">Tiện nghi</h2>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">{t.amenities.map((a) => <div key={a} className="flex items-center gap-2 text-sm"><Check className="size-4 text-primary" />{a}</div>)}</div>
            <h2 className="mt-8 text-lg font-semibold">Chính sách</h2>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground"><li>Nhận phòng từ 14:00 · Trả phòng trước 12:00</li><li>Đặt cọc 30% để giữ phòng; phần còn lại thanh toán khi trả phòng</li><li>Phòng được giữ trong 10 phút khi bạn hoàn tất đặt phòng</li></ul>
          </div>
          <div className="card-soft sticky top-24 h-fit p-6">
            <div className="text-2xl font-semibold">{vnd(t.price)} <span className="text-sm font-normal text-muted-foreground">/ đêm</span></div>
            <div className="mt-4 rounded-xl border p-3"><DateRangeField from={from} to={to} onChange={(a, b) => { setFrom(a); setTo(b); }} /></div>
            <div className="mt-4 divide-y">
              <KV k={`${vnd(t.price)} × ${n} đêm`} v={vnd(t.price * n)} />
              <KV k="Đặt cọc ngay (30%)" v={vnd(t.price * n * 0.3)} />
              <KV k="Tình trạng" v={free ? `Còn ${free} phòng` : "Hết phòng"} />
            </div>
            <Button asChild size="lg" className="mt-5 w-full rounded-full" disabled={!free}>
              <Link to="/book/$typeId" params={{ typeId }} search={{ from, to, guests: s.guests }} disabled={!free}>Đặt phòng này</Link>
            </Button>
          </div>
        </div>
      </div>
    </SiteLayout>
  );
}
