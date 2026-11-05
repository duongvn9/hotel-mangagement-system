import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Search, LogIn, LogOut } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { PageHeader, StatusBadge, EmptyState } from "@/components/hms/ui";
import { useLookup, useStore } from "@/lib/store";
import { day, type Booking } from "@/lib/mock";
import { vnd, fshort } from "@/lib/format";

export const Route = createFileRoute("/app/front-desk")({
  head: () => ({ meta: [{ title: "Quầy lễ tân — Emily Hotel" }, { name: "description", content: "Làm thủ tục nhận và trả phòng." }, { property: "og:title", content: "Quầy lễ tân" }, { property: "og:description", content: "Nhận phòng và trả phòng" }] }),
  component: FrontDesk,
});

function FrontDesk() {
  const { data, guest, room, roomType } = useLookup();
  const [tab, setTab] = useState<"in" | "out">("in");
  const [q, setQ] = useState("");
  const [confirm, setConfirm] = useState<Booking | null>(null);
  const rows = data.bookings.filter((b) => (tab === "in" ? b.status === "CONFIRMED" && b.checkIn <= day(1) : b.status === "CHECKED_IN"))
    .filter((b) => `${b.id} ${guest(b.guestId)?.name} ${room(b.roomId)?.number}`.toLowerCase().includes(q.toLowerCase()));
  const go = () => {
    const b = confirm!; useStore.getState().setBookingStatus(b.id, tab === "in" ? "CHECKED_IN" : "CHECKED_OUT");
    toast.success(tab === "in" ? `${guest(b.guestId)?.name} đã nhận phòng · phòng ${room(b.roomId)?.number} đang có khách` : `Đã trả phòng · phòng ${room(b.roomId)?.number} chuyển sang dọn dẹp`);
    setConfirm(null);
  };
  return (
    <div>
      <PageHeader title="Quầy lễ tân" subtitle="Tìm đặt phòng và hoàn tất nhận hoặc trả phòng." />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}><TabsList className="rounded-full"><TabsTrigger className="rounded-full" value="in">Nhận phòng</TabsTrigger><TabsTrigger className="rounded-full" value="out">Trả phòng</TabsTrigger></TabsList></Tabs>
        <div className="relative sm:ml-auto sm:w-80"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="rounded-full pl-9" placeholder="Mã đặt phòng, tên khách hoặc số phòng" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      </div>
      {rows.length === 0 ? <EmptyState title={tab === "in" ? "Không có khách sắp đến" : "Không có khách đang lưu trú"} /> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((b) => {
            const bal = b.total - b.paid;
            return (
              <div key={b.id} className="card-soft p-5">
                <div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">{b.id}</span><StatusBadge status={b.status} /></div>
                <div className="mt-2 text-lg font-semibold">{guest(b.guestId)?.name}</div>
                <div className="text-sm text-muted-foreground">Phòng {room(b.roomId)?.number} · {roomType(b.roomId)?.name}</div>
                <div className="mt-3 flex justify-between text-sm"><span>{fshort(b.checkIn)} → {fshort(b.checkOut)}</span><span>{tab === "out" ? `Còn lại ${vnd(bal)}` : `${b.guests} khách`}</span></div>
                <div className="mt-4 flex gap-2">
                  <Button className="flex-1 rounded-full" onClick={() => setConfirm(b)}>{tab === "in" ? <><LogIn className="size-4" />Nhận phòng</> : <><LogOut className="size-4" />Trả phòng</>}</Button>
                  <Button asChild variant="outline" className="rounded-full"><Link to="/app/bookings/$id" params={{ id: b.id }}>Chi tiết</Link></Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{tab === "in" ? "Xác nhận nhận phòng" : "Xác nhận trả phòng"}</AlertDialogTitle>
          <AlertDialogDescription>{confirm && (tab === "in" ? `Kiểm tra CCCD ${guest(confirm.guestId)?.idNumber} của ${guest(confirm.guestId)?.name}, sau đó giao chìa khoá phòng ${room(confirm.roomId)?.number}.` : `Thu số tiền còn lại ${vnd(confirm.total - confirm.paid)} và đóng hoá đơn.`)}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Huỷ</AlertDialogCancel><AlertDialogAction onClick={go}>Xác nhận</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
