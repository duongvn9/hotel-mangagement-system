import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SiteLayout } from "@/components/hms/SiteLayout";
import { KV, StatusBadge } from "@/components/hms/ui";
import { useLookup, useStore, newId } from "@/lib/store";
import { day } from "@/lib/mock";
import { vnd, fdate } from "@/lib/format";

export const Route = createFileRoute("/payment-return")({
  validateSearch: (s: Record<string, unknown>): { booking?: string; status?: string } => ({ booking: (s.booking as string) || undefined, status: (s.status as string) || undefined }),
  head: () => ({ meta: [
    { title: "Kết quả thanh toán — Emily Hotel" },
    { name: "description", content: "Kết quả đặt cọc của bạn." },
    { property: "og:title", content: "Kết quả thanh toán — Emily Hotel" },
    { property: "og:description", content: "Xác nhận đặt phòng và trạng thái thanh toán." },
  ] }),
  component: PaymentReturn,
});

function PaymentReturn() {
  const { booking: id = "" } = Route.useSearch();
  const { booking, roomType, guest, room } = useLookup();
  const role = useStore((s) => s.role);
  const b = booking(id);
  if (!b) return <SiteLayout><div className="mx-auto max-w-lg p-16 text-center text-muted-foreground">Không tìm thấy đặt phòng. <Link to="/lookup" className="text-primary">Tra cứu đặt phòng</Link></div></SiteLayout>;
  const ok = b.status === "CONFIRMED";
  const retry = () => {
    const s = useStore.getState();
    s.patch("bookings", b.id, { status: "CONFIRMED", paid: b.deposit });
    s.upsert("payments", { id: newId("PM"), bookingId: b.id, amount: b.deposit, method: "VNPAY", status: "SUCCESS", reconciled: false, date: day(0) });
    toast.success("Đã nhận tiền cọc — đặt phòng đã xác nhận");
  };
  return (
    <SiteLayout>
      <div className="mx-auto max-w-xl px-5 py-16">
        <div className="card-soft p-8 text-center">
          {ok ? <CheckCircle2 className="mx-auto size-14 text-success" /> : <XCircle className="mx-auto size-14 text-danger" />}
          <h1 className="mt-4 font-display text-4xl">{ok ? "Đặt phòng thành công." : "Thanh toán chưa thành công"}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{ok ? `Email xác nhận đã được gửi tới ${guest(b.guestId)?.email}.` : "Phòng vẫn được giữ trong khi chờ đặt cọc. Bạn có thể thử lại."}</p>
          <div className="mt-6 divide-y rounded-xl border px-4 text-left">
            <KV k="Mã đặt phòng" v={b.id} /><KV k="Phòng" v={`${roomType(b.roomId)?.name} · ${room(b.roomId)?.number}`} />
            <KV k="Ngày" v={`${fdate(b.checkIn)} → ${fdate(b.checkOut)}`} /><KV k="Tiền cọc" v={vnd(b.deposit)} /><KV k="Trạng thái" v={<StatusBadge status={b.status} />} />
          </div>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {!ok && <Button className="rounded-full" onClick={retry}>Thử thanh toán lại</Button>}
            {role === "CUSTOMER" ? <Button asChild variant={ok ? "default" : "outline"} className="rounded-full"><Link to="/app/my-bookings">Đến Đặt phòng của tôi</Link></Button>
              : <Button asChild variant="outline" className="rounded-full"><Link to="/lookup" search={{ code: b.id }}>Quản lý đặt phòng</Link></Button>}
          </div>
        </div>
      </div>
    </SiteLayout>
  );
}
