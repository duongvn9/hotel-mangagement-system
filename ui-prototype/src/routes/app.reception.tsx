import { createFileRoute, Link } from "@tanstack/react-router";
import { LogIn, LogOut, BedDouble, Wallet, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel, StatCard, StatusBadge } from "@/components/hms/ui";
import { useLookup } from "@/lib/store";
import { day } from "@/lib/mock";
import { vnd } from "@/lib/format";

export const Route = createFileRoute("/app/reception")({
  head: () => ({ meta: [{ title: "Bảng điều khiển lễ tân — Emily Hotel" }, { name: "description", content: "Khách đến và đi hôm nay." }, { property: "og:title", content: "Bảng điều khiển lễ tân" }, { property: "og:description", content: "Lễ tân" }] }),
  component: Reception,
});

function Reception() {
  const { data, guest, room } = useLookup();
  const today = day(0);
  const arrivals = data.bookings.filter((b) => b.status === "CONFIRMED" && b.checkIn <= today);
  const departures = data.bookings.filter((b) => b.status === "CHECKED_IN" && b.checkOut <= day(1));
  const free = data.rooms.filter((r) => r.status === "AVAILABLE").length;
  const unrec = data.payments.filter((p) => !p.reconciled && p.status === "SUCCESS");
  const List = ({ rows }: { rows: typeof arrivals }) => rows.length === 0 ? <p className="text-sm text-muted-foreground">Không có lịch.</p> : (
    <div className="divide-y">{rows.map((b) => <Link key={b.id} to="/app/bookings/$id" params={{ id: b.id }} className="flex items-center justify-between py-3 text-sm hover:text-primary"><span><span className="block font-medium">{guest(b.guestId)?.name}</span><span className="text-xs text-muted-foreground">{b.id} · Phòng {room(b.roomId)?.number}</span></span><StatusBadge status={b.status} /></Link>)}</div>
  );
  return (
    <div>
      <PageHeader eyebrow="Lễ tân" title="Chào buổi tối, Yến" subtitle="Tình hình tại quầy lễ tân hôm nay." actions={<><Button asChild variant="outline" className="rounded-full"><Link to="/app/front-desk">Mở quầy lễ tân</Link></Button><Button asChild className="rounded-full"><Link to="/app/walk-in"><UserPlus className="size-4" />Tại quầy</Link></Button></>} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Khách đến hôm nay" value={arrivals.length} icon={LogIn} />
        <StatCard label="Khách trả phòng" value={departures.length} icon={LogOut} />
        <StatCard label="Phòng trống" value={`${free} / ${data.rooms.length}`} icon={BedDouble} />
        <StatCard label="Cần đối soát" value={vnd(unrec.reduce((s, p) => s + p.amount, 0))} hint={`${unrec.length} giao dịch`} icon={Wallet} />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Khách đến" action={<Link to="/app/front-desk" className="text-xs text-primary">Nhận phòng →</Link>}><List rows={arrivals} /></Panel>
        <Panel title="Khách trả phòng" action={<Link to="/app/front-desk" className="text-xs text-primary">Trả phòng →</Link>}><List rows={departures} /></Panel>
      </div>
    </div>
  );
}
