import { createFileRoute, Link } from "@tanstack/react-router";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { PageHeader, StatusBadge, EmptyState } from "@/components/hms/ui";
import { useLookup, useStore } from "@/lib/store";
import { vnd, fdate } from "@/lib/format";

export const Route = createFileRoute("/app/my-bookings")({
  head: () => ({ meta: [{ title: "Đặt phòng của tôi — Emily Hotel" }, { name: "description", content: "Đặt phòng sắp tới và đã qua của bạn." }, { property: "og:title", content: "Đặt phòng của tôi" }, { property: "og:description", content: "Lịch sử đặt phòng" }] }),
  component: MyBookings,
});

const groups = { upcoming: ["ROOM_HELD", "PENDING_DEPOSIT", "CONFIRMED", "CHECKED_IN"], past: ["CHECKED_OUT"], cancelled: ["CANCELLED", "EXPIRED"] };

function MyBookings() {
  const { data, roomType, room } = useLookup();
  const me = useStore((s) => s.customerId);
  const [tab, setTab] = useState<keyof typeof groups>("upcoming");
  const list = data.bookings.filter((b) => b.guestId === me && groups[tab].includes(b.status));
  return (
    <div>
      <PageHeader title="Đặt phòng của tôi" subtitle="Xem, thay đổi hoặc huỷ đặt phòng." actions={<Button asChild className="rounded-full"><Link to="/rooms">Đặt phòng mới</Link></Button>} />
      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}><TabsList className="rounded-full"><TabsTrigger value="upcoming" className="rounded-full">Sắp tới</TabsTrigger><TabsTrigger value="past" className="rounded-full">Đã qua</TabsTrigger><TabsTrigger value="cancelled" className="rounded-full">Đã huỷ</TabsTrigger></TabsList></Tabs>
      <div className="mt-6 grid gap-4">
        {list.length === 0 && <EmptyState title={`Không có đặt phòng ${({ upcoming: "sắp tới", past: "đã qua", cancelled: "đã huỷ" } as const)[tab]}`} body="Đặt phòng của bạn sẽ hiển thị ở đây." />}
        {list.map((b) => (
          <Link key={b.id} to="/app/bookings/$id" params={{ id: b.id }} className="card-soft flex flex-col gap-4 overflow-hidden p-3 transition hover:shadow-lift sm:flex-row sm:items-center">
            <img src={roomType(b.roomId)?.image} alt="" className="h-28 w-full rounded-xl object-cover sm:w-44" />
            <div className="flex-1">
              <div className="flex items-center gap-2"><span className="font-semibold">{roomType(b.roomId)?.name}</span><StatusBadge status={b.status} /></div>
              <div className="mt-1 text-sm text-muted-foreground">{b.id} · Phòng {room(b.roomId)?.number} · {b.guests} khách</div>
              <div className="mt-1 text-sm">{fdate(b.checkIn)} → {fdate(b.checkOut)}</div>
            </div>
            <div className="px-3 text-right"><div className="font-semibold">{vnd(b.total)}</div><div className="text-xs text-muted-foreground">Đã trả {vnd(b.paid)}</div></div>
          </Link>
        ))}
      </div>
    </div>
  );
}
