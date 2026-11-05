import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, Wrench, Cpu, ClipboardList } from "lucide-react";
import { PageHeader, Panel, StatCard, StatusBadge } from "@/components/hms/ui";
import { useLookup } from "@/lib/store";

export const Route = createFileRoute("/app/operations")({
  head: () => ({ meta: [{ title: "Bảng điều khiển vận hành — Emily Hotel" }, { name: "description", content: "Sự cố và bảo trì." }, { property: "og:title", content: "Bảng điều khiển vận hành" }, { property: "og:description", content: "Nhân viên vận hành" }] }),
  component: Ops,
});

function Ops() {
  const { data, room } = useLookup();
  const open = data.issues.filter((i) => i.status !== "RESOLVED");
  return (
    <div>
      <PageHeader eyebrow="Vận hành" title="Xin chào, Tiến" subtitle="Hỏng hóc cần sửa và thiết bị cần theo dõi." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Sự cố đang mở" value={open.length} icon={AlertTriangle} />
        <StatCard label="Ưu tiên cao" value={open.filter((i) => i.severity === "HIGH").length} icon={AlertTriangle} />
        <StatCard label="Phòng đang bảo trì" value={data.rooms.filter((r) => r.status === "MAINTENANCE").length} icon={Wrench} />
        <StatCard label="Thiết bị cần sửa" value={data.equipment.filter((e) => e.condition !== "GOOD").length} icon={Cpu} />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Sự cố đang mở" action={<Link to="/app/issues" className="text-xs text-primary">Tất cả sự cố →</Link>}>
          <div className="divide-y">{open.map((i) => <div key={i.id} className="flex items-center justify-between py-3 text-sm"><span><b>{i.title}</b><span className="block text-xs text-muted-foreground">{i.id} · Room {room(i.roomId)?.number}</span></span><StatusBadge status={i.severity} /></div>)}</div>
        </Panel>
        <Panel title="Công việc của tôi" action={<Link to="/app/tasks" className="text-xs text-primary">Bảng công việc →</Link>}>
          <div className="divide-y">{data.tasks.filter((t) => t.assignee === "Bùi Tiến").map((t) => <div key={t.id} className="flex items-center justify-between py-3 text-sm"><span className="flex items-center gap-2"><ClipboardList className="size-4 text-primary" />{t.title}</span><StatusBadge status={t.status} /></div>)}</div>
        </Panel>
      </div>
    </div>
  );
}
