import { createFileRoute, Link } from "@tanstack/react-router";
import { ConciergeBell, ClipboardList, Loader, CheckCircle2 } from "lucide-react";
import { PageHeader, Panel, StatCard, StatusBadge } from "@/components/hms/ui";
import { useLookup } from "@/lib/store";

export const Route = createFileRoute("/app/service-desk")({
  head: () => ({ meta: [{ title: "Bảng điều khiển dịch vụ — Emily Hotel" }, { name: "description", content: "Yêu cầu dịch vụ và buồng phòng." }, { property: "og:title", content: "Bảng điều khiển dịch vụ" }, { property: "og:description", content: "Nhân viên dịch vụ" }] }),
  component: ServiceDesk,
});

function ServiceDesk() {
  const { data, service, room, booking } = useLookup();
  const pending = data.serviceOrders.filter((o) => o.status === "PENDING");
  const my = data.tasks.filter((t) => t.role === "SERVICE_STAFF" && t.assignee === "Mai Phương");
  return (
    <div>
      <PageHeader eyebrow="Đội dịch vụ" title="Xin chào, Phương" subtitle="Đơn đang chờ và công việc hôm nay của bạn." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Đơn mới" value={pending.length} icon={ConciergeBell} />
        <StatCard label="Đang xử lý" value={data.serviceOrders.filter((o) => o.status === "IN_PROGRESS").length} icon={Loader} />
        <StatCard label="Việc chưa xong" value={my.filter((t) => t.status !== "DONE").length} icon={ClipboardList} />
        <StatCard label="Phòng cần dọn" value={data.rooms.filter((r) => r.status === "CLEANING").length} icon={CheckCircle2} />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Đơn đang chờ" action={<Link to="/app/service-orders" className="text-xs text-primary">Tất cả đơn →</Link>}>
          {pending.length === 0 ? <p className="text-sm text-muted-foreground">Không có đơn mới.</p> : <div className="divide-y">{pending.map((o) => <div key={o.id} className="flex items-center justify-between py-3 text-sm"><span><b>{service(o.serviceId)?.name}</b> × {o.qty}<span className="block text-xs text-muted-foreground">Room {room(booking(o.bookingId)?.roomId ?? "")?.number} · {o.id}</span></span><StatusBadge status={o.status} /></div>)}</div>}
        </Panel>
        <Panel title="Công việc của tôi" action={<Link to="/app/tasks" className="text-xs text-primary">Xem công việc →</Link>}>
          <div className="divide-y">{my.map((t) => <div key={t.id} className="flex items-center justify-between py-3 text-sm"><span>{t.title}<span className="block text-xs text-muted-foreground">{t.id}</span></span><StatusBadge status={t.status} /></div>)}</div>
        </Panel>
      </div>
    </div>
  );
}
