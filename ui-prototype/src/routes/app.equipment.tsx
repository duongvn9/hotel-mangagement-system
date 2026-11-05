import { createFileRoute } from "@tanstack/react-router";
import { CrudPage, opts } from "@/components/hms/CrudPage";
import { StatusBadge } from "@/components/hms/ui";
import { useStore } from "@/lib/store";
import { day, type Equipment } from "@/lib/mock";
import { fdate } from "@/lib/format";

export const Route = createFileRoute("/app/equipment")({
  head: () => ({ meta: [{ title: "Thiết bị — Emily Hotel" }, { name: "description", content: "Thiết bị trong phòng và tình trạng." }, { property: "og:title", content: "Thiết bị" }, { property: "og:description", content: "Danh mục thiết bị" }] }),
  component: EquipmentPage,
});

function EquipmentPage() {
  const rooms = useStore((s) => s.data.rooms);
  const num = (id: string) => rooms.find((r) => r.id === id)?.number;
  return (
    <CrudPage<Equipment> title="Thiết bị" subtitle="Theo dõi tình trạng thiết bị trong phòng." collection="equipment" noun="thiết bị" idPrefix="E"
      defaults={{ name: "", roomId: rooms[0].id, condition: "GOOD", lastService: day(0) }}
      search={(e) => `${e.name} ${num(e.roomId)}`}
      filters={[{ key: "condition", label: "Tình trạng", options: ["GOOD", "NEEDS_REPAIR", "BROKEN"] }]}
      columns={[
        { key: "id", header: "Mã" }, { key: "name", header: "Thiết bị", render: (e) => <span className="font-medium">{e.name}</span> },
        { key: "room", header: "Phòng", render: (e) => num(e.roomId) },
        { key: "last", header: "Bảo trì gần nhất", render: (e) => fdate(e.lastService) },
        { key: "condition", header: "Tình trạng", render: (e) => <StatusBadge status={e.condition} /> },
      ]}
      fields={[
        { name: "name", label: "Tên", required: true },
        { name: "roomId", label: "Phòng", type: "select", required: true, options: rooms.map((r) => ({ value: r.id, label: `Phòng ${r.number}` })) },
        { name: "condition", label: "Tình trạng", type: "select", options: opts(["GOOD", "NEEDS_REPAIR", "BROKEN"]) },
        { name: "lastService", label: "Bảo trì gần nhất", type: "date" },
      ]} />
  );
}
