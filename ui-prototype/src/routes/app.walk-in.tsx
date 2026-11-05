import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateRangeField } from "@/components/hms/DateRangeField";
import { PageHeader, Panel, KV } from "@/components/hms/ui";
import { useStore, freeRooms, newId } from "@/lib/store";
import { day, nights } from "@/lib/mock";
import { vnd } from "@/lib/format";

export const Route = createFileRoute("/app/walk-in")({
  head: () => ({ meta: [{ title: "Đặt phòng tại quầy — Emily Hotel" }, { name: "description", content: "Đặt phòng ngay tại quầy." }, { property: "og:title", content: "Đặt phòng tại quầy" }, { property: "og:description", content: "Đặt phòng tại quầy" }] }),
  component: WalkIn,
});

function WalkIn() {
  const data = useStore((s) => s.data);
  const navigate = useNavigate();
  const [r, setR] = useState({ from: day(0), to: day(2), typeId: "deluxe", roomId: "", guests: "2" });
  const [g, setG] = useState({ name: "", phone: "", email: "", idNumber: "", nationality: "Vietnam" });
  const [checkInNow, setCheckInNow] = useState("yes");
  const t = data.roomTypes.find((x) => x.id === r.typeId)!;
  const avail = freeRooms(data, r.typeId, r.from, r.to).filter((x) => x.status === "AVAILABLE" || r.from > day(0));
  const total = t.price * nights(r.from, r.to);
  const submit = () => {
    if (!r.roomId) return toast.error("Hãy chọn phòng");
    if (g.name.trim().length < 2 || !/^[+\d\s]{9,15}$/.test(g.phone) || g.idNumber.length < 6) return toast.error("Cần nhập tên, số điện thoại và số CCCD");
    const s = useStore.getState();
    const gid = newId("g"); s.upsert("guests", { id: gid, ...g, email: g.email || "—" });
    const id = newId("BK");
    s.createBooking({ id, guestId: gid, roomId: r.roomId, checkIn: r.from, checkOut: r.to, guests: Number(r.guests), status: "CONFIRMED", source: "WALK_IN", total, deposit: Math.round(total * 0.3), paid: Math.round(total * 0.3), createdAt: day(0) });
    s.upsert("payments", { id: newId("PM"), bookingId: id, amount: Math.round(total * 0.3), method: "CASH", status: "SUCCESS", reconciled: false, date: day(0) });
    if (checkInNow === "yes" && r.from === day(0)) s.setBookingStatus(id, "CHECKED_IN");
    toast.success(`Đã tạo đặt phòng tại quầy ${id}`);
    navigate({ to: "/app/bookings/$id", params: { id } });
  };
  return (
    <div>
      <PageHeader title="Đặt phòng tại quầy" subtitle="Tạo đặt phòng cho khách tại quầy và thu cọc bằng tiền mặt." />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="grid gap-6">
          <Panel title="1 · Lưu trú">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border p-3 sm:col-span-2"><DateRangeField from={r.from} to={r.to} onChange={(a, b) => setR({ ...r, from: a, to: b, roomId: "" })} /></div>
              <div className="grid gap-1.5"><Label>Loại phòng</Label><Select value={r.typeId} onValueChange={(v) => setR({ ...r, typeId: v, roomId: "" })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{data.roomTypes.map((x) => <SelectItem key={x.id} value={x.id}>{x.name} · {vnd(x.price)}</SelectItem>)}</SelectContent></Select></div>
              <div className="grid gap-1.5"><Label>Số khách</Label><Input type="number" min={1} max={t.capacity} value={r.guests} onChange={(e) => setR({ ...r, guests: e.target.value })} /></div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {avail.length === 0 && <p className="text-sm text-danger">Không còn phòng loại này trong những ngày đã chọn.</p>}
              {avail.map((x) => <button key={x.id} onClick={() => setR({ ...r, roomId: x.id })} className={`rounded-xl border px-4 py-2 text-sm ${r.roomId === x.id ? "border-primary bg-primary/10 text-primary" : ""}`}>{x.number}</button>)}
            </div>
          </Panel>
          <Panel title="2 · Khách">
            <div className="grid gap-4 sm:grid-cols-2">
              {([["name", "Họ và tên"], ["phone", "Điện thoại"], ["email", "Email (không bắt buộc)"], ["idNumber", "CCCD / hộ chiếu"], ["nationality", "Quốc tịch"]] as const).map(([k, l]) => <div key={k} className="grid gap-1.5"><Label htmlFor={k}>{l}</Label><Input id={k} value={g[k]} onChange={(e) => setG({ ...g, [k]: e.target.value })} /></div>)}
            </div>
          </Panel>
        </div>
        <Panel title="Tóm tắt" className="h-fit">
          <div className="divide-y"><KV k="Loại phòng" v={t.name} /><KV k="Phòng" v={data.rooms.find((x) => x.id === r.roomId)?.number ?? "—"} /><KV k="Số đêm" v={nights(r.from, r.to)} /><KV k="Tổng" v={vnd(total)} /><KV k="Cọc tiền mặt (30%)" v={vnd(total * 0.3)} /></div>
          <div className="mt-4 grid gap-1.5"><Label>Nhận phòng ngay</Label><Select value={checkInNow} onValueChange={setCheckInNow}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="yes">Có, khách đang ở quầy</SelectItem><SelectItem value="no">Không, để sau</SelectItem></SelectContent></Select></div>
          <Button className="mt-5 w-full rounded-full" onClick={submit}>Tạo đặt phòng</Button>
        </Panel>
      </div>
    </div>
  );
}
