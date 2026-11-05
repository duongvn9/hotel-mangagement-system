import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { BedDouble, Maximize2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { SiteLayout } from "@/components/hms/SiteLayout";
import { EmptyState } from "@/components/hms/ui";
import { useStore, freeRooms } from "@/lib/store";
import { day, nights } from "@/lib/mock";
import { vnd, fshort } from "@/lib/format";
import { SearchBar } from "@/components/hms/SearchBar";
import { cn } from "@/lib/utils";


export const Route = createFileRoute("/rooms/")({
  validateSearch: (s: Record<string, unknown>): { from?: string; to?: string; guests?: number } => ({ from: (s.from as string) || undefined, to: (s.to as string) || undefined, guests: Number(s.guests) || undefined }),
  head: () => ({ meta: [
    { title: "Phòng & suite — Emily Hotel" },
    { name: "description", content: "Tìm phòng và suite còn trống theo ngày và số khách." },
    { property: "og:title", content: "Phòng & suite — Emily Hotel" },
    { property: "og:description", content: "Tìm phòng trống cho ngày bạn chọn." },
  ] }),
  component: Rooms,
});

function Rooms() {
  const { from = day(3), to = day(6), guests = 2 } = Route.useSearch();
  const data = useStore((s) => s.data);
  const [max, setMax] = useState(5000000);
  const [sort, setSort] = useState<"price" | "size">("price");
  const n = nights(from, to);
  const list = data.roomTypes
    .filter((t) => t.capacity >= guests && t.price <= max)
    .map((t) => ({ t, free: freeRooms(data, t.id, from, to).length }))
    .sort((a, b) => (sort === "price" ? a.t.price - b.t.price : b.t.size - a.t.size));

  return (
    <SiteLayout>
      <div className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
        <h1 className="font-display text-5xl">Tìm phòng của bạn</h1>
        <p className="mt-2 text-muted-foreground">{fshort(from)} — {fshort(to)} · {n} đêm · {guests} khách</p>
        <div className="mt-6"><SearchBar compact /></div>
        <div className="mt-10 grid gap-8 lg:grid-cols-[260px_1fr]">
          <aside className="card-soft h-fit space-y-6 p-5">
            <div>
              <div className="text-sm font-semibold">Giá tối đa / đêm</div>
              <div className="mt-1 text-xs text-muted-foreground">{vnd(max)}</div>
              <Slider className="mt-4" min={1000000} max={5000000} step={100000} value={[max]} onValueChange={(v) => setMax(v[0])} />
            </div>
            <div>
              <div className="mb-2 text-sm font-semibold">Sắp xếp</div>
              <div className="flex gap-2">{(["price", "size"] as const).map((k) => <button key={k} onClick={() => setSort(k)} className={cn("rounded-full border px-3 py-1.5 text-xs", sort === k ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground")}>{k === "price" ? "Giá thấp nhất" : "Rộng nhất"}</button>)}</div>
            </div>
          </aside>
          <div className="grid gap-5">
            {list.length === 0 && <EmptyState title="Không có phòng phù hợp" body="Thử giảm số khách hoặc tăng mức giá." />}
            {list.map(({ t, free }) => (
              <div key={t.id} className="card-soft grid overflow-hidden md:grid-cols-[320px_1fr]">
                <img src={t.image} alt={t.name} loading="lazy" width={1200} height={912} className="h-56 w-full object-cover md:h-full" />
                <div className="flex flex-col p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="font-display text-3xl">{t.name}</h2>
                      <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1"><Maximize2 className="size-3.5" />{t.size} m²</span>
                        <span className="flex items-center gap-1"><BedDouble className="size-3.5" />{t.bed}</span>
                        <span className="flex items-center gap-1"><Users className="size-3.5" />Tối đa {t.capacity}</span>
                      </div>
                    </div>
                    <span className={cn("rounded-full px-3 py-1 text-xs font-medium", free ? "bg-success/12 text-success" : "bg-danger/10 text-danger")}>{free ? `Còn ${free} phòng` : "Hết phòng"}</span>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">{t.description}</p>
                  <div className="mt-3 flex flex-wrap gap-2">{t.amenities.slice(0, 4).map((a) => <span key={a} className="rounded-full bg-surface px-3 py-1 text-xs">{a}</span>)}</div>
                  <div className="mt-auto flex items-end justify-between pt-6">
                    <div><div className="text-xl font-semibold">{vnd(t.price)}<span className="text-sm font-normal text-muted-foreground"> / đêm</span></div><div className="text-xs text-muted-foreground">Tổng {vnd(t.price * n)}</div></div>
                    <div className="flex gap-2">
                      <Button asChild variant="outline" className="rounded-full"><Link to="/rooms/$typeId" params={{ typeId: t.id }} search={{ from, to, guests }}>Chi tiết</Link></Button>
                      <Button asChild disabled={!free} className="rounded-full"><Link to="/book/$typeId" params={{ typeId: t.id }} search={{ from, to, guests }} disabled={!free}>Đặt ngay</Link></Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </SiteLayout>
  );
}
