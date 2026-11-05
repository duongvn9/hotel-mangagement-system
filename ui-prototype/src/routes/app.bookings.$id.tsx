import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronLeft, LogIn, LogOut, XCircle, Pencil, CreditCard, ArrowLeftRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DateRangeField } from "@/components/hms/DateRangeField";
import { EmptyState, KV, Panel, StatusBadge } from "@/components/hms/ui";
import { useLookup, useStore, freeRooms, newId } from "@/lib/store";
import { day, nights } from "@/lib/mock";
import { vnd, fdate, label } from "@/lib/format";

export const Route = createFileRoute("/app/bookings/$id")({
  head: () => ({ meta: [{ title: "Chi tiết đặt phòng — Emily Hotel" }, { name: "description", content: "Thông tin và thao tác đặt phòng." }, { property: "og:title", content: "Chi tiết đặt phòng" }, { property: "og:description", content: "Thông tin đặt phòng" }] }),
  component: BookingDetail,
});

function BookingDetail() {
  const { id } = Route.useParams();
  const { data, booking, guest, room, roomType, service } = useLookup();
  const role = useStore((s) => s.role);
  const me = useStore((s) => s.customerId);
  const st = useStore.getState;
  const b = booking(id);
  const [edit, setEdit] = useState(false);
  const [cancel, setCancel] = useState(false);
  const [move, setMove] = useState(false);
  const [range, setRange] = useState({ from: b?.checkIn ?? day(1), to: b?.checkOut ?? day(2), guests: String(b?.guests ?? 2) });
  const [newRoom, setNewRoom] = useState("");

  if (!b || (role === "CUSTOMER" && b.guestId !== me)) return <EmptyState title="Không tìm thấy đặt phòng" body="Đặt phòng có thể đã bị xoá hoặc thuộc về khách khác." action={<Button asChild variant="outline"><Link to={role === "CUSTOMER" ? "/app/my-bookings" : "/app/bookings"}>Quay lại danh sách</Link></Button>} />;
  const g = guest(b.guestId); const t = roomType(b.roomId)!;
  const staff = role === "RECEPTIONIST" || role === "MANAGER";
  const editable = ["CONFIRMED", "PENDING_DEPOSIT"].includes(b.status);
  const pays = data.payments.filter((p) => p.bookingId === b.id);
  const orders = data.serviceOrders.filter((o) => o.bookingId === b.id);
  const serviceTotal = orders.filter((o) => o.status !== "CANCELLED").reduce((s, o) => s + (service(o.serviceId)?.price ?? 0) * o.qty, 0);
  const balance = b.total + serviceTotal - b.paid;
  const act = (s: Parameters<ReturnType<typeof st>["setBookingStatus"]>[1], msg: string) => { st().setBookingStatus(b.id, s); toast.success(msg); };

  const saveEdit = () => {
    const n = nights(range.from, range.to);
    if (Number(range.guests) > t.capacity) return toast.error(`Phòng này tối đa ${t.capacity} khách`);
    const clash = data.bookings.some((x) => x.id !== b.id && x.roomId === b.roomId && ["CONFIRMED", "CHECKED_IN"].includes(x.status) && x.checkIn < range.to && x.checkOut > range.from);
    if (clash) return toast.error("Phòng không còn trống trong những ngày này");
    const total = t.price * n;
    st().patch("bookings", b.id, { checkIn: range.from, checkOut: range.to, guests: Number(range.guests), total, deposit: Math.round(total * 0.3) });
    toast.success("Đã cập nhật đặt phòng"); setEdit(false);
  };

  return (
    <div>
      <Link to={role === "CUSTOMER" ? "/app/my-bookings" : "/app/bookings"} className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ChevronLeft className="size-4" />Đặt phòng</Link>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-3"><h1 className="text-2xl font-semibold">{b.id}</h1><StatusBadge status={b.status} /><StatusBadge status={b.source} /></div>
          <p className="mt-1 text-sm text-muted-foreground">{g?.name} · {t.name} · Phòng {room(b.roomId)?.number}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {staff && b.status === "CONFIRMED" && <Button className="rounded-full" onClick={() => act("CHECKED_IN", `${g?.name} đã nhận phòng ${room(b.roomId)?.number}`)}><LogIn className="size-4" />Nhận phòng</Button>}
          {staff && b.status === "CHECKED_IN" && <Button className="rounded-full" onClick={() => act("CHECKED_OUT", `Đã trả phòng · đã thu ${vnd(balance)} · đã tạo việc dọn phòng`)}><LogOut className="size-4" />Trả phòng & thanh toán</Button>}
          {staff && b.status === "PENDING_DEPOSIT" && <Button className="rounded-full" onClick={() => { st().upsert("payments", { id: newId("PM"), bookingId: b.id, amount: b.deposit, method: "CASH", status: "SUCCESS", reconciled: false, date: day(0) }); act("CONFIRMED", "Đã ghi nhận tiền cọc — đặt phòng đã xác nhận"); }}><CreditCard className="size-4" />Ghi nhận tiền cọc</Button>}
          {role === "CUSTOMER" && b.status === "PENDING_DEPOSIT" && <Button asChild className="rounded-full"><Link to="/payment-return" search={{ booking: b.id, status: "failed" }}><CreditCard className="size-4" />Thanh toán cọc</Link></Button>}
          {staff && ["CONFIRMED", "CHECKED_IN"].includes(b.status) && <Button variant="outline" className="rounded-full" onClick={() => setMove(true)}><ArrowLeftRight className="size-4" />Đổi phòng</Button>}
          {editable && <Button variant="outline" className="rounded-full" onClick={() => setEdit(true)}><Pencil className="size-4" />Sửa</Button>}
          {editable && <Button variant="ghost" className="rounded-full text-destructive" onClick={() => setCancel(true)}><XCircle className="size-4" />Huỷ</Button>}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="grid gap-6">
          <Panel title="Lưu trú">
            <div className="grid gap-x-8 sm:grid-cols-2">
              <KV k="Nhận phòng" v={fdate(b.checkIn)} /><KV k="Trả phòng" v={fdate(b.checkOut)} />
              <KV k="Số đêm" v={nights(b.checkIn, b.checkOut)} /><KV k="Số khách" v={b.guests} />
              <KV k="Loại phòng" v={t.name} /><KV k="Phòng" v={room(b.roomId)?.number} />
              <KV k="Ngày đặt" v={fdate(b.createdAt)} /><KV k="Ghi chú" v={b.notes ?? "—"} />
            </div>
          </Panel>
          <Panel title="Thanh toán">
            {pays.length === 0 ? <p className="text-sm text-muted-foreground">Chưa có thanh toán nào.</p> : (
              <div className="divide-y">{pays.map((p) => <div key={p.id} className="flex items-center justify-between py-2.5 text-sm"><span>{p.id} · {label(p.method)} · {fdate(p.date)}</span><span className="flex items-center gap-3">{vnd(p.amount)}<StatusBadge status={p.status} /></span></div>)}</div>
            )}
          </Panel>
          <Panel title="Yêu cầu dịch vụ">
            {orders.length === 0 ? <p className="text-sm text-muted-foreground">Chưa có dịch vụ nào cho kỳ lưu trú này.</p> : (
              <div className="divide-y">{orders.map((o) => <div key={o.id} className="flex items-center justify-between py-2.5 text-sm"><span>{service(o.serviceId)?.name} × {o.qty}</span><span className="flex items-center gap-3">{vnd((service(o.serviceId)?.price ?? 0) * o.qty)}<StatusBadge status={o.status} /></span></div>)}</div>
            )}
          </Panel>
        </div>
        <div className="grid h-fit gap-6">
          <Panel title="Hoá đơn">
            <div className="divide-y">
              <KV k={`Tiền phòng · ${nights(b.checkIn, b.checkOut)} đêm`} v={vnd(b.total)} /><KV k="Dịch vụ" v={vnd(serviceTotal)} />
              <KV k="Tiền cọc (30%)" v={vnd(b.deposit)} /><KV k="Đã thanh toán" v={vnd(b.paid)} />
              <KV k="Còn lại" v={<span className={balance > 0 ? "text-primary" : "text-success"}>{vnd(Math.max(0, balance))}</span>} />
            </div>
          </Panel>
          <Panel title="Khách">
            <div className="divide-y"><KV k="Tên" v={g?.name} /><KV k="Email" v={g?.email} /><KV k="Điện thoại" v={g?.phone} />{staff && <KV k="CCCD / hộ chiếu" v={g?.idNumber || "—"} />}<KV k="Quốc tịch" v={g?.nationality} /></div>
          </Panel>
        </div>
      </div>

      <Dialog open={edit} onOpenChange={setEdit}>
        <DialogContent><DialogHeader><DialogTitle>Sửa đặt phòng</DialogTitle><DialogDescription>Thay đổi ngày hoặc số khách. Giá sẽ tự động cập nhật.</DialogDescription></DialogHeader>
          <div className="grid gap-4">
            <div className="rounded-xl border p-3"><DateRangeField from={range.from} to={range.to} onChange={(f, t2) => setRange({ ...range, from: f, to: t2 })} /></div>
            <div className="grid gap-1.5"><Label>Số khách</Label><Input type="number" min={1} value={range.guests} onChange={(e) => setRange({ ...range, guests: e.target.value })} /></div>
            <div className="rounded-xl bg-surface p-3 text-sm">Tổng mới: <b>{vnd(t.price * nights(range.from, range.to))}</b></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setEdit(false)}>Huỷ</Button><Button onClick={saveEdit}>Lưu thay đổi</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={move} onOpenChange={setMove}>
        <DialogContent><DialogHeader><DialogTitle>Đổi phòng</DialogTitle><DialogDescription>Chỉ hiển thị phòng trống cùng loại.</DialogDescription></DialogHeader>
          <Select value={newRoom} onValueChange={setNewRoom}><SelectTrigger><SelectValue placeholder="Chọn phòng" /></SelectTrigger>
            <SelectContent>{freeRooms(data, t.id, b.checkIn, b.checkOut).map((r) => <SelectItem key={r.id} value={r.id}>Phòng {r.number} · tầng {r.floor}</SelectItem>)}</SelectContent></Select>
          <DialogFooter><Button disabled={!newRoom} onClick={() => { const old = b.roomId; st().patch("bookings", b.id, { roomId: newRoom }); if (b.status === "CHECKED_IN") { st().patch("rooms", newRoom, { status: "OCCUPIED" }); st().patch("rooms", old, { status: "CLEANING" }); } toast.success(`Đã chuyển sang phòng ${room(newRoom)?.number}`); setMove(false); }}>Chuyển khách</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={cancel} onOpenChange={setCancel}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Cancel booking {b.id}?</AlertDialogTitle><AlertDialogDescription>Phòng sẽ được mở lại. Tiền cọc không hoàn lại nếu huỷ trong vòng 48 giờ trước khi nhận phòng.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Giữ đặt phòng</AlertDialogCancel><AlertDialogAction onClick={() => act("CANCELLED", "Đã huỷ đặt phòng")}>Huỷ đặt phòng</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
