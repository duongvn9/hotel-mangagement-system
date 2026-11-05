import { createFileRoute } from "@tanstack/react-router";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel, StatCard } from "@/components/hms/ui";
import { RevenueArea, SimpleBars, revenueSeries } from "@/components/hms/charts";
import { useLookup } from "@/lib/store";
import { vnd } from "@/lib/format";

export const Route = createFileRoute("/app/revenue")({
  head: () => ({ meta: [{ title: "Báo cáo doanh thu — Emily Hotel" }, { name: "description", content: "Doanh thu theo kỳ, loại phòng và kênh." }, { property: "og:title", content: "Báo cáo doanh thu" }, { property: "og:description", content: "Doanh thu" }] }),
  component: Revenue,
});

function Revenue() {
  const { data, roomType, service } = useLookup();
  const series = revenueSeries(data, 30);
  const room = data.bookings.filter((b) => b.status !== "CANCELLED" && b.status !== "EXPIRED");
  const byType = data.roomTypes.map((t) => ({ name: t.name.split(" ")[0], revenue: room.filter((b) => roomType(b.roomId)?.id === t.id).reduce((s, b) => s + b.total, 0) / 1e6 }));
  const svc = data.serviceOrders.filter((o) => o.status === "DONE").reduce((s, o) => s + (service(o.serviceId)?.price ?? 0) * o.qty, 0);
  const roomRev = room.reduce((s, b) => s + b.total, 0);
  return (
    <div>
      <PageHeader title="Báo cáo doanh thu" subtitle="30 ngày gần nhất" actions={<Button variant="outline" className="rounded-full" onClick={() => toast.success("Đã xuất báo cáo bao-cao-doanh-thu.xlsx")}><Download className="size-4" />Xuất file</Button>} />
      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <StatCard label="Doanh thu phòng" value={vnd(roomRev)} /><StatCard label="Doanh thu dịch vụ" value={vnd(svc)} />
        <StatCard label="Giá TB / đặt phòng" value={vnd(roomRev / Math.max(1, room.length))} hint="giá trị trung bình mỗi đặt phòng" /><StatCard label="Tỷ lệ trực tuyến" value={`${Math.round((room.filter((b) => b.source === "ONLINE").length / room.length) * 100)}%`} />
      </div>
      <Panel title="Doanh thu theo ngày"><RevenueArea series={series} /></Panel>
      <Panel title="Doanh thu theo loại phòng (triệu ₫)" className="mt-6"><SimpleBars data={byType} k="revenue" /></Panel>
    </div>
  );
}
