import { createFileRoute } from "@tanstack/react-router";
import { CrudPage, opts } from "@/components/hms/CrudPage";
import { StatusBadge } from "@/components/hms/ui";
import { useStore } from "@/lib/store";
import type { Room } from "@/lib/mock";
import { vnd } from "@/lib/format";

export const Route = createFileRoute("/app/rooms")({
  head: () => ({ meta: [{ title: "Phòng — Emily Hotel" }, { name: "description", content: "Quản lý phòng." }, { property: "og:title", content: "Phòng" }, { property: "og:description", content: "Quản lý phòng" }] }),
  component: RoomsAdmin,
});

function RoomsAdmin() {
  const types = useStore((s) => s.data.roomTypes);
  const t = (id: string) => types.find((x) => x.id === id);
  return (
    <CrudPage<Room> title="Phòng" subtitle="Thêm phòng, gán loại phòng và kiểm soát tình trạng." collection="rooms" noun="Phòng" idPrefix="r"
      defaults={{ number: "", floor: 1, typeId: types[0].id, status: "AVAILABLE" }}
      search={(r) => `${r.number} ${t(r.typeId)?.name}`}
      filters={[{ key: "status", label: "Trạng thái", options: ["AVAILABLE", "OCCUPIED", "CLEANING", "MAINTENANCE"] }, { key: "typeId", label: "Loại", options: types.map((x) => x.id) }]}
      columns={[
        { key: "number", header: "Phòng", render: (r) => <span className="font-medium">{r.number}</span> },
        { key: "floor", header: "Tầng" }, { key: "type", header: "Loại", render: (r) => t(r.typeId)?.name },
        { key: "price", header: "Giá", render: (r) => vnd(t(r.typeId)?.price ?? 0) },
        { key: "status", header: "Trạng thái", render: (r) => <StatusBadge status={r.status} /> },
      ]}
      fields={[
        { name: "number", label: "Số phòng", required: true },
        { name: "floor", label: "Tầng", type: "number", required: true, min: 1 },
        { name: "typeId", label: "Loại phòng", type: "select", required: true, options: types.map((x) => ({ value: x.id, label: x.name })) },
        { name: "status", label: "Tình trạng", type: "select", options: opts(["AVAILABLE", "CLEANING", "MAINTENANCE"]) },
      ]} />
  );
}
