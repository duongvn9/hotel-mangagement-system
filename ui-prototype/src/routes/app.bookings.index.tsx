import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/hms/DataTable";
import { PageHeader, StatusBadge } from "@/components/hms/ui";
import { useLookup, useStore } from "@/lib/store";
import { vnd, fshort } from "@/lib/format";
import type { Booking } from "@/lib/mock";

export const Route = createFileRoute("/app/bookings/")({
  head: () => ({ meta: [{ title: "Đặt phòng — Emily Hotel" }, { name: "description", content: "Tất cả đặt phòng." }, { property: "og:title", content: "Đặt phòng" }, { property: "og:description", content: "Quản lý đặt phòng" }] }),
  component: Bookings,
});

function Bookings() {
  const { data, guest, room, roomType } = useLookup();
  const role = useStore((s) => s.role);
  const navigate = useNavigate();
  const rows = [...data.bookings].sort((a, b) => b.checkIn.localeCompare(a.checkIn));
  return (
    <div>
      <PageHeader title="Đặt phòng" subtitle="Tìm kiếm, lọc và mở bất kỳ đặt phòng nào." actions={role === "RECEPTIONIST" && <Button asChild className="rounded-full"><Link to="/app/walk-in"><UserPlus className="size-4" />Đặt phòng tại quầy</Link></Button>} />
      <DataTable<Booking>
        rows={rows}
        search={(b) => `${b.id} ${guest(b.guestId)?.name} ${room(b.roomId)?.number}`}
        filters={[
          { key: "status", label: "Trạng thái", options: ["ROOM_HELD", "PENDING_DEPOSIT", "CONFIRMED", "CHECKED_IN", "CHECKED_OUT", "CANCELLED", "EXPIRED"] },
          { key: "source", label: "Nguồn", options: ["ONLINE", "WALK_IN"] },
        ]}
        onRowClick={(b) => navigate({ to: "/app/bookings/$id", params: { id: b.id } })}
        columns={[
          { key: "id", header: "Mã", render: (b) => <span className="font-medium">{b.id}</span> },
          { key: "guest", header: "Khách", render: (b) => <div><div>{guest(b.guestId)?.name}</div><div className="text-xs text-muted-foreground">{guest(b.guestId)?.phone}</div></div> },
          { key: "room", header: "Phòng", render: (b) => <div><div>{room(b.roomId)?.number}</div><div className="text-xs text-muted-foreground">{roomType(b.roomId)?.name}</div></div> },
          { key: "dates", header: "Ngày", render: (b) => `${fshort(b.checkIn)} → ${fshort(b.checkOut)}` },
          { key: "total", header: "Tổng", render: (b) => vnd(b.total), className: "text-right" },
          { key: "status", header: "Trạng thái", render: (b) => <StatusBadge status={b.status} /> },
        ]}
      />
    </div>
  );
}
