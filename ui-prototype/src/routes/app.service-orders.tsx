import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DataTable } from "@/components/hms/DataTable";
import { PageHeader, KV, StatusBadge } from "@/components/hms/ui";
import { useLookup, useStore } from "@/lib/store";
import { vnd, fdate, label } from "@/lib/format";
import type { ServiceOrder } from "@/lib/mock";

export const Route = createFileRoute("/app/service-orders")({
  head: () => ({ meta: [{ title: "Yêu cầu dịch vụ — Emily Hotel" }, { name: "description", content: "Xử lý yêu cầu dịch vụ của khách." }, { property: "og:title", content: "Yêu cầu dịch vụ" }, { property: "og:description", content: "Hàng đợi đơn" }] }),
  component: Orders,
});

function Orders() {
  const { data, service, room, booking, guest } = useLookup();
  const [openId, setOpenId] = useState<string | null>(null);
  const open = data.serviceOrders.find((o) => o.id === openId);
  const set = (o: ServiceOrder, status: ServiceOrder["status"]) => { useStore.getState().patch("serviceOrders", o.id, { status, assignee: o.assignee ?? "Mai Phương" }); toast.success(`${o.id} → ${label(status).toLowerCase()}`); };
  const rm = (o: ServiceOrder) => room(booking(o.bookingId)?.roomId ?? "")?.number;
  return (
    <div>
      <PageHeader title="Yêu cầu dịch vụ" subtitle="Nhận, giao và hoàn tất yêu cầu của khách." />
      <DataTable<ServiceOrder> rows={data.serviceOrders} onRowClick={(o) => setOpenId(o.id)} search={(o) => `${o.id} ${service(o.serviceId)?.name} ${rm(o)}`}
        filters={[{ key: "status", label: "Trạng thái", options: ["PENDING", "IN_PROGRESS", "DONE", "CANCELLED"] }]}
        columns={[
          { key: "id", header: "Đơn", render: (o) => <span className="font-medium">{o.id}</span> },
          { key: "svc", header: "Dịch vụ", render: (o) => `${service(o.serviceId)?.name} × ${o.qty}` },
          { key: "room", header: "Phòng", render: rm },
          { key: "date", header: "Thời gian đặt", render: (o) => fdate(o.createdAt) },
          { key: "who", header: "Người phụ trách", render: (o) => o.assignee ?? <span className="text-muted-foreground">Chưa phân công</span> },
          { key: "status", header: "Trạng thái", render: (o) => <StatusBadge status={o.status} /> },
        ]} />
      <Sheet open={!!open} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent><SheetHeader><SheetTitle>Đơn {open?.id}</SheetTitle></SheetHeader>
          {open && <div className="px-4">
            <div className="divide-y"><KV k="Dịch vụ" v={service(open.serviceId)?.name} /><KV k="Số lượng" v={open.qty} /><KV k="Số tiền" v={vnd((service(open.serviceId)?.price ?? 0) * open.qty)} /><KV k="Phòng" v={rm(open)} /><KV k="Khách" v={guest(booking(open.bookingId)?.guestId ?? "")?.name} /><KV k="Ghi chú" v={open.note ?? "—"} /><KV k="Trạng thái" v={<StatusBadge status={open.status} />} /></div>
            <div className="mt-6 grid gap-2">
              {open.status === "PENDING" && <Button className="rounded-full" onClick={() => set(open, "IN_PROGRESS")}>Nhận & bắt đầu</Button>}
              {open.status === "IN_PROGRESS" && <Button className="rounded-full" onClick={() => set(open, "DONE")}>Đánh dấu đã giao</Button>}
              {open.status === "PENDING" && <Button variant="outline" className="rounded-full text-destructive" onClick={() => set(open, "CANCELLED")}>Từ chối đơn</Button>}
            </div>
          </div>}
        </SheetContent>
      </Sheet>
    </div>
  );
}
