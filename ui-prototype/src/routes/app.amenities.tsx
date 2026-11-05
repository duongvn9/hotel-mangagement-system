import { createFileRoute } from "@tanstack/react-router";
import { CrudPage, opts } from "@/components/hms/CrudPage";
import type { Amenity } from "@/lib/mock";
import { label } from "@/lib/format";

export const Route = createFileRoute("/app/amenities")({
  head: () => ({ meta: [{ title: "Tiện nghi — Emily Hotel" }, { name: "description", content: "Quản lý tiện nghi phòng." }, { property: "og:title", content: "Tiện nghi" }, { property: "og:description", content: "Tiện nghi" }] }),
  component: () => (
    <CrudPage<Amenity> title="Tiện nghi" subtitle="Tiện nghi hiển thị trên phòng và trang web." collection="amenities" noun="Tiện nghi" idPrefix="a"
      defaults={{ name: "", category: "Comfort" }} search={(a) => a.name}
      filters={[{ key: "category", label: "Danh mục", options: ["Essentials", "Comfort", "Premium"] }]}
      columns={[{ key: "name", header: "Tiện nghi", render: (a) => <span className="font-medium">{a.name}</span> }, { key: "category", header: "Danh mục", render: (a) => label(a.category) }]}
      fields={[{ name: "name", label: "Tên", required: true }, { name: "category", label: "Danh mục", type: "select", options: opts(["Essentials", "Comfort", "Premium"]).map((o) => ({ ...o, value: o.value })) }]} />
  ),
});
