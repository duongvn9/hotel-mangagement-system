import { createFileRoute } from "@tanstack/react-router";
import { DataTable } from "@/components/hms/DataTable";
import { PageHeader, StatCard } from "@/components/hms/ui";
import { useLookup } from "@/lib/store";
import { fdate, vnd } from "@/lib/format";
import type { Maintenance } from "@/lib/mock";

export const Route = createFileRoute("/app/maintenance")({
  head: () => ({ meta: [{ title: "Lịch sử bảo trì — Emily Hotel" }, { name: "description", content: "Các lần sửa chữa và bảo dưỡng đã hoàn tất." }, { property: "og:title", content: "Lịch sử bảo trì" }, { property: "og:description", content: "Nhật ký sửa chữa" }] }),
  component: Maint,
});

function Maint() {
  const { data, room } = useLookup();
  const eq = (id: string) => data.equipment.find((e) => e.id === id);
  return (
    <div>
      <PageHeader title="Lịch sử bảo trì" subtitle="Mọi lần sửa chữa, bảo dưỡng, gắn với thiết bị và sự cố liên quan." />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Số bản ghi" value={data.maintenance.length} />
        <StatCard label="Tổng chi phí" value={vnd(data.maintenance.reduce((s, m) => s + m.cost, 0))} />
        <StatCard label="Kỹ thuật viên" value={new Set(data.maintenance.map((m) => m.technician)).size} />
      </div>
      <DataTable<Maintenance> rows={data.maintenance} search={(m) => `${m.action} ${m.technician} ${eq(m.equipmentId)?.name}`}
        filters={[{ key: "technician", label: "Kỹ thuật viên", options: [...new Set(data.maintenance.map((m) => m.technician))] }]}
        columns={[
          { key: "date", header: "Ngày", render: (m) => fdate(m.date) },
          { key: "eq", header: "Thiết bị", render: (m) => `${eq(m.equipmentId)?.name ?? m.equipmentId} · phòng ${room(eq(m.equipmentId)?.roomId ?? "")?.number ?? "—"}` },
          { key: "action", header: "Công việc đã làm" }, { key: "technician", header: "Kỹ thuật viên" },
          { key: "issue", header: "Sự cố", render: (m) => m.issueId ?? "Định kỳ" },
          { key: "cost", header: "Chi phí", render: (m) => vnd(m.cost), className: "text-right" },
        ]} />
    </div>
  );
}
