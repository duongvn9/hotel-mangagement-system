import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Panel, StatCard } from "@/components/hms/ui";
import { SimpleBars, Donut } from "@/components/hms/charts";
import { useLookup } from "@/lib/store";
import { label } from "@/lib/format";

export const Route = createFileRoute("/app/operations-report")({
  head: () => ({ meta: [{ title: "Báo cáo vận hành — Emily Hotel" }, { name: "description", content: "Chỉ số công suất, công việc và sự cố." }, { property: "og:title", content: "Báo cáo vận hành" }, { property: "og:description", content: "Chỉ số vận hành" }] }),
  component: OpsReport,
});

function OpsReport() {
  const { data } = useLookup();
  const byFloor = [...new Set(data.rooms.map((r) => r.floor))].map((f) => ({ name: `Tầng ${f}`, occupied: data.rooms.filter((r) => r.floor === f && r.status === "OCCUPIED").length }));
  const bStatus = ["CONFIRMED", "CHECKED_IN", "CHECKED_OUT", "CANCELLED", "PENDING_DEPOSIT"].map((s) => ({ name: label(s), value: data.bookings.filter((b) => b.status === s).length }));
  const done = data.tasks.filter((t) => t.status === "DONE").length;
  return (
    <div>
      <PageHeader title="Báo cáo vận hành" subtitle="Tình hình vận hành khách sạn hôm nay." />
      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <StatCard label="Tỷ lệ hoàn thành việc" value={`${Math.round((done / data.tasks.length) * 100)}%`} hint={`${done}/${data.tasks.length}`} />
        <StatCard label="Sự cố đang mở" value={data.issues.filter((i) => i.status !== "RESOLVED").length} />
        <StatCard label="Dịch vụ đã hoàn thành" value={data.serviceOrders.filter((o) => o.status === "DONE").length} />
        <StatCard label="Tỷ lệ huỷ" value={`${Math.round((data.bookings.filter((b) => b.status === "CANCELLED").length / data.bookings.length) * 100)}%`} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Phòng có khách theo tầng"><SimpleBars data={byFloor} k="occupied" color="var(--chart-2)" /></Panel>
        <Panel title="Đặt phòng theo trạng thái"><Donut data={bStatus} /></Panel>
      </div>
    </div>
  );
}
