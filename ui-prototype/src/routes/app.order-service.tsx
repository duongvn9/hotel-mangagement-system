import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PageHeader, Panel, StatusBadge, EmptyState, KV } from "@/components/hms/ui";
import { useLookup, useStore, newId } from "@/lib/store";
import { day, type ServiceOrder } from "@/lib/mock";
import { vnd, fdate } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/order-service")({
  head: () => ({ meta: [{ title: "Dịch vụ phòng — Emily Hotel" }, { name: "description", content: "Đặt dịch vụ trong kỳ lưu trú." }, { property: "og:title", content: "Dịch vụ phòng" }, { property: "og:description", content: "Dịch vụ lưu trú" }] }),
  component: OrderService,
});

function OrderService() {
  const { data, service, room } = useLookup();
  const me = useStore((s) => s.customerId);
  const stay = data.bookings.find((b) => b.guestId === me && b.status === "CHECKED_IN");
  const [pick, setPick] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");
  const [open, setOpen] = useState<ServiceOrder | null>(null);
  const mine = data.serviceOrders.filter((o) => data.bookings.some((b) => b.id === o.bookingId && b.guestId === me));

  const submit = () => {
    if (!stay || !pick) return;
    useStore.getState().upsert("serviceOrders", { id: newId("SO"), bookingId: stay.id, serviceId: pick, qty, status: "PENDING", createdAt: day(0), note: note || undefined });
    toast.success(`Đã đặt ${service(pick)?.name} — nhân viên đã được thông báo`);
    setPick(null); setQty(1); setNote("");
  };

  return (
    <div>
      <PageHeader title="Dịch vụ phòng" subtitle={stay ? `Đặt cho phòng ${room(stay.roomId)?.number} · ${stay.id}` : "Bạn có thể đặt dịch vụ khi đang lưu trú."} />
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <Panel title="Đơn mới">
          {!stay ? <EmptyState title="Bạn chưa nhận phòng" body="Sau khi nhận phòng, bạn có thể đặt bữa sáng, giặt ủi, đưa đón và nhiều dịch vụ khác tại đây." /> : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                {data.services.filter((s) => s.active).map((s) => (
                  <button key={s.id} onClick={() => setPick(s.id)} className={cn("rounded-xl border p-4 text-left transition", pick === s.id ? "border-primary bg-primary/5" : "hover:border-primary/50")}>
                    <div className="font-medium">{s.name}</div><div className="text-xs text-muted-foreground">{s.category}</div><div className="mt-2 text-sm">{vnd(s.price)}</div>
                  </button>
                ))}
              </div>
              {pick && (
                <div className="mt-6 grid gap-4 border-t pt-6">
                  <div className="flex items-center gap-3"><span className="text-sm">Số lượng</span>
                    <Button size="icon" variant="outline" className="size-8 rounded-full" onClick={() => setQty(Math.max(1, qty - 1))}><Minus className="size-3" /></Button><span className="w-6 text-center">{qty}</span>
                    <Button size="icon" variant="outline" className="size-8 rounded-full" onClick={() => setQty(Math.min(10, qty + 1))}><Plus className="size-3" /></Button>
                    <span className="ml-auto font-semibold">{vnd((service(pick)?.price ?? 0) * qty)}</span></div>
                  <Textarea placeholder="Ghi chú cho nhân viên (không bắt buộc)" value={note} onChange={(e) => setNote(e.target.value)} />
                  <Button className="w-fit rounded-full" onClick={submit}>Đặt dịch vụ</Button>
                </div>
              )}
            </>
          )}
        </Panel>
        <Panel title="Lịch sử đặt dịch vụ">
          {mine.length === 0 ? <p className="text-sm text-muted-foreground">Chưa có đơn nào.</p> : (
            <div className="divide-y">{mine.map((o) => <button key={o.id} onClick={() => setOpen(o)} className="flex w-full items-center justify-between py-3 text-left text-sm hover:text-primary"><span><span className="block font-medium">{service(o.serviceId)?.name} × {o.qty}</span><span className="text-xs text-muted-foreground">{o.id} · {fdate(o.createdAt)}</span></span><StatusBadge status={o.status} /></button>)}</div>
          )}
        </Panel>
      </div>
      <Sheet open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent><SheetHeader><SheetTitle>Đơn {open?.id}</SheetTitle></SheetHeader>
          {open && <div className="mt-4 divide-y px-4"><KV k="Dịch vụ" v={service(open.serviceId)?.name} /><KV k="Số lượng" v={open.qty} /><KV k="Số tiền" v={vnd((service(open.serviceId)?.price ?? 0) * open.qty)} /><KV k="Trạng thái" v={<StatusBadge status={open.status} />} /><KV k="Ghi chú" v={open.note ?? "—"} />
            {open.status === "PENDING" && <Button variant="outline" className="mt-4 w-full rounded-full text-destructive" onClick={() => { useStore.getState().patch("serviceOrders", open.id, { status: "CANCELLED" }); toast.success("Đã huỷ đơn"); setOpen(null); }}>Huỷ đơn</Button>}
            <Link to="/app/bookings/$id" params={{ id: open.bookingId }} className="block py-3 text-sm text-primary">Xem đặt phòng {open.bookingId}</Link></div>}
        </SheetContent>
      </Sheet>
    </div>
  );
}
