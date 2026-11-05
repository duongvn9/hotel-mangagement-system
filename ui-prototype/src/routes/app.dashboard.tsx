import { createFileRoute, Link } from "@tanstack/react-router";
import { BedDouble, TrendingUp, CalendarDays, Star } from "lucide-react";
import { PageHeader, Panel, StatCard, StatusBadge } from "@/components/hms/ui";
import { RevenueArea, Donut, revenueSeries } from "@/components/hms/charts";
import { useLookup } from "@/lib/store";
import { vnd, fshort, label } from "@/lib/format";

export const Route = createFileRoute("/app/dashboard")({
  head: () => ({ meta: [{ title: "Bảng điều khiển quản lý — Emily Hotel" }, { name: "description", content: "Tổng quan hiệu quả khách sạn." }, { property: "og:title", content: "Bảng điều khiển quản lý" }, { property: "og:description", content: "KPIs" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { data, guest, room } = useLookup();
  const occ = data.rooms.filter((r) => r.status === "OCCUPIED").length;
  const series = revenueSeries(data);
  const rev = series.reduce((s, x) => s + x.revenue, 0);
  const avg = data.feedback.reduce((s, f) => s + f.rating, 0) / Math.max(1, data.feedback.length);
  const statusCounts = (["AVAILABLE", "OCCUPIED", "CLEANING", "MAINTENANCE"] as const).map((s) => ({ name: label(s), value: data.rooms.filter((r) => r.status === s).length }));
  const recent = [...data.bookings].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6);
  return (
    <div>
      <PageHeader eyebrow="Tổng quan" title="Hiệu quả hoạt động" subtitle="14 ngày gần nhất tại Emily Hotel." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Công suất phòng" value={`${Math.round((occ / data.rooms.length) * 100)}%`} hint={`${occ} / ${data.rooms.length} phòng`} icon={BedDouble} />
        <StatCard label="Doanh thu · 14 ngày" value={vnd(rev)} trend="+8.2%" hint="so với kỳ trước" icon={TrendingUp} />
        <StatCard label="Đặt phòng đang hiệu lực" value={data.bookings.filter((b) => ["CONFIRMED", "CHECKED_IN"].includes(b.status)).length} icon={CalendarDays} />
        <StatCard label="Điểm đánh giá" value={avg.toFixed(1)} hint={`${data.feedback.length} đánh giá`} icon={Star} />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
        <Panel title="Doanh thu" action={<Link to="/app/revenue" className="text-xs text-primary">Xem báo cáo →</Link>}><RevenueArea series={series} /></Panel>
        <Panel title="Trạng thái phòng" action={<Link to="/app/room-board" className="text-xs text-primary">Xem sơ đồ →</Link>}><Donut data={statusCounts} /></Panel>
      </div>
      <Panel title="Đặt phòng mới nhất" className="mt-6" action={<Link to="/app/bookings" className="text-xs text-primary">Tất cả đặt phòng →</Link>}>
        <div className="divide-y">{recent.map((b) => <Link key={b.id} to="/app/bookings/$id" params={{ id: b.id }} className="grid grid-cols-2 items-center gap-2 py-3 text-sm hover:text-primary sm:grid-cols-5"><span className="font-medium">{b.id}</span><span>{guest(b.guestId)?.name}</span><span className="hidden sm:block">Phòng {room(b.roomId)?.number}</span><span className="hidden sm:block">{fshort(b.checkIn)} → {fshort(b.checkOut)}</span><span className="sm:text-right"><StatusBadge status={b.status} /></span></Link>)}</div>
      </Panel>
    </div>
  );
}
