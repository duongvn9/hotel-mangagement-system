import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarDays, ConciergeBell, MessageSquareHeart, Wallet, ArrowRight, Users, BedDouble, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, StatCard, StatusBadge, EmptyState } from "@/components/hms/ui";
import { useLookup, useStore } from "@/lib/store";
import { vnd, fdate } from "@/lib/format";
import { nights } from "@/lib/mock";

export const Route = createFileRoute("/app/home")({
  head: () => ({ meta: [{ title: "Kỳ nghỉ của tôi — Emily Hotel" }, { name: "description", content: "Kỳ nghỉ sắp tới và dịch vụ của bạn." }, { property: "og:title", content: "Kỳ nghỉ của tôi — Emily Hotel" }, { property: "og:description", content: "Tổng quan khách hàng" }] }),
  component: CustomerHome,
});

function CustomerHome() {
  const { data, guest, roomType, room } = useLookup();
  const me = useStore((s) => s.customerId);
  const mine = data.bookings.filter((b) => b.guestId === me);
  const next = mine.filter((b) => ["CONFIRMED", "CHECKED_IN", "PENDING_DEPOSIT"].includes(b.status)).sort((a, b) => a.checkIn.localeCompare(b.checkIn))[0];
  const nextType = next ? roomType(next.roomId) : undefined;
  const nextRoom = next ? room(next.roomId) : undefined;
  const orders = data.serviceOrders.filter((o) => mine.some((b) => b.id === o.bookingId));
  return (
    <div>
      <PageHeader eyebrow="Tổng quan" title={`Chào buổi tối, ${guest(me)?.name.split(" ").slice(-1)[0]}`} subtitle="Mọi thông tin về kỳ nghỉ của bạn, ở cùng một nơi." actions={<Button asChild className="rounded-full"><Link to="/rooms">Đặt phòng mới</Link></Button>} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Đặt phòng" value={mine.length} icon={CalendarDays} />
        <StatCard label="Số đêm đã ở" value={mine.filter((b) => b.status === "CHECKED_OUT").reduce((s, b) => s + nights(b.checkIn, b.checkOut), 0)} icon={CalendarDays} />
        <StatCard label="Yêu cầu dịch vụ" value={orders.length} icon={ConciergeBell} />
        <StatCard label="Tổng đã thanh toán" value={vnd(mine.reduce((s, b) => s + b.paid, 0))} icon={Wallet} />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
        {next ? (
          <div className="card-soft p-2 md:grid md:grid-cols-[0.78fr_1fr] md:gap-2">
            <div className="relative overflow-hidden rounded-xl">
              <img src={nextType?.image} alt="" className="h-56 w-full object-cover md:h-full" />
              <div className="absolute inset-0 bg-gradient-to-t from-ink/50 via-ink/10 to-transparent" />
              <div className="absolute bottom-3 left-3 rounded-full bg-ink/55 px-3 py-1 text-xs font-medium text-ink-foreground backdrop-blur-sm">
                Phòng {nextRoom?.number} · Tầng {nextRoom?.floor}
              </div>
            </div>
            <div className="flex flex-col p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <span className="whitespace-nowrap text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Kỳ nghỉ tiếp theo</span>
                <StatusBadge status={next.status} />
              </div>
              <h2 className="mt-2 font-display text-[26px] leading-[1.2] text-balance">{nextType?.name}</h2>
              <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5"><Users className="size-3.5" /> {next.guests} khách</span>
                <span className="inline-flex items-center gap-1.5"><BedDouble className="size-3.5" /> {nextType?.bed}</span>
                <span className="inline-flex items-center gap-1.5"><Maximize2 className="size-3.5" /> {nextType?.size} m²<span className="text-muted-foreground/40">·</span>{nights(next.checkIn, next.checkOut)} đêm</span>
              </p>
              <div className="mt-5 grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-border/50 bg-surface px-4 py-3">
                  <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Nhận phòng</div>
                  <div className="mt-1 text-sm font-medium">{fdate(next.checkIn)}</div>
                </div>
                <div className="rounded-xl border border-border/50 bg-surface px-4 py-3">
                  <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Trả phòng</div>
                  <div className="mt-1 text-sm font-medium">{fdate(next.checkOut)}</div>
                </div>
              </div>
              <div className="mt-auto grid grid-cols-[1.15fr_1fr] gap-2 pt-6">
                <Button asChild className="w-full justify-center rounded-full px-3">
                  <Link to="/app/bookings/$id" params={{ id: next.id }}>Xem đặt phòng <ArrowRight className="size-4" /></Link>
                </Button>
                {next.status === "CHECKED_IN" && (
                  <Button asChild variant="outline" className="w-full justify-center rounded-full px-3">
                    <Link to="/app/order-service">Đặt dịch vụ</Link>
                  </Button>
                )}
              </div>
            </div>
          </div>
        ) : <EmptyState title="Chưa có kỳ nghỉ sắp tới" body="Khi bạn đặt phòng, kỳ nghỉ tiếp theo sẽ hiện ở đây." action={<Button asChild className="rounded-full"><Link to="/rooms">Xem phòng</Link></Button>} />}
        <div className="grid gap-3">
          {[["/app/order-service", "Đặt dịch vụ phòng", ConciergeBell], ["/app/feedback", "Gửi đánh giá", MessageSquareHeart], ["/app/my-bookings", "Lịch sử đặt phòng", CalendarDays]].map(([to, l, I]: any) => (
            <Link key={to} to={to} className="card-soft flex items-center gap-3 p-4 hover:border-primary"><I className="size-5 text-primary" /><span className="flex-1 text-sm font-medium">{l}</span><ArrowRight className="size-4 text-muted-foreground" /></Link>
          ))}
        </div>
      </div>
    </div>
  );
}
