import { createFileRoute } from "@tanstack/react-router";
import { CrudPage } from "@/components/hms/CrudPage";
import { useStore } from "@/lib/store";
import { images, type RoomType } from "@/lib/mock";
import { vnd } from "@/lib/format";

export const Route = createFileRoute("/app/room-types")({
  head: () => ({ meta: [{ title: "Loại phòng — Emily Hotel" }, { name: "description", content: "Quản lý hạng phòng và giá." }, { property: "og:title", content: "Loại phòng" }, { property: "og:description", content: "Quản lý loại phòng" }] }),
  component: Types,
});

function Types() {
  const rooms = useStore((s) => s.data.rooms);
  return (
    <CrudPage<RoomType> title="Loại phòng" subtitle="Hạng phòng, giá mỗi đêm và sức chứa hiển thị trên trang web." collection="roomTypes" noun="Loại phòng" idPrefix="type"
      defaults={{ name: "", price: 1500000, capacity: 2, size: 30, bed: "1 giường Queen", image: images.deluxe, description: "", amenities: ["Wi‑Fi"] }}
      search={(t) => t.name}
      columns={[
        { key: "name", header: "Loại", render: (t) => <div className="flex items-center gap-3"><img src={t.image} alt="" className="size-10 rounded-lg object-cover" /><span className="font-medium">{t.name}</span></div> },
        { key: "price", header: "Giá / đêm", render: (t) => vnd(t.price) },
        { key: "capacity", header: "Số khách" }, { key: "size", header: "Diện tích", render: (t) => `${t.size} m²` },
        { key: "rooms", header: "Phòng", render: (t) => rooms.filter((r) => r.typeId === t.id).length },
      ]}
      fields={[
        { name: "name", label: "Tên", required: true },
        { name: "price", label: "Giá mỗi đêm (₫)", type: "number", required: true, min: 100000 },
        { name: "capacity", label: "Số khách tối đa", type: "number", required: true, min: 1 },
        { name: "size", label: "Diện tích (m²)", type: "number", required: true, min: 10 },
        { name: "bed", label: "Cấu hình giường", required: true },
        { name: "description", label: "Mô tả", type: "textarea" },
      ]} />
  );
}
