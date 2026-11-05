import { createFileRoute } from "@tanstack/react-router";
import { CrudPage } from "@/components/hms/CrudPage";
import { StatusBadge } from "@/components/hms/ui";
import type { Service } from "@/lib/mock";
import { vnd } from "@/lib/format";

const cats = ["Ẩm thực", "Buồng phòng", "Di chuyển", "Chăm sóc sức khoẻ", "Giải trí"];
export const Route = createFileRoute("/app/services")({
  head: () => ({ meta: [{ title: "Dịch vụ — Emily Hotel" }, { name: "description", content: "Quản lý danh mục dịch vụ cho khách." }, { property: "og:title", content: "Dịch vụ" }, { property: "og:description", content: "Danh mục dịch vụ" }] }),
  component: () => (
    <CrudPage<Service> title="Dịch vụ" subtitle="Những dịch vụ khách có thể đặt khi lưu trú." collection="services" noun="Dịch vụ" idPrefix="s"
      defaults={{ name: "", category: "Ẩm thực", price: 100000, active: true }} search={(s) => s.name}
      filters={[{ key: "category", label: "Danh mục", options: cats }]}
      columns={[
        { key: "name", header: "Dịch vụ", render: (s) => <span className="font-medium">{s.name}</span> }, { key: "category", header: "Danh mục" },
        { key: "price", header: "Giá", render: (s) => vnd(s.price) }, { key: "active", header: "Trạng thái", render: (s) => <StatusBadge status={s.active ? "ACTIVE" : "INACTIVE"} /> },
      ]}
      fields={[{ name: "name", label: "Tên", required: true }, { name: "category", label: "Danh mục", type: "select", options: cats.map((c) => ({ value: c, label: c })) }, { name: "price", label: "Giá (₫)", type: "number", required: true, min: 0 }, { name: "active", label: "Hiển thị cho khách", type: "switch" }]} />
  ),
});
