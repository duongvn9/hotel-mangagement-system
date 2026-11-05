import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SiteLayout } from "@/components/hms/SiteLayout";
import { EmptyState, KV, StatusBadge } from "@/components/hms/ui";
import { useLookup } from "@/lib/store";
import { vnd, fdate } from "@/lib/format";

export const Route = createFileRoute("/lookup")({
  validateSearch: (s: Record<string, unknown>): { code?: string } => ({ code: (s.code as string) || undefined }),
  head: () => ({ meta: [
    { title: "Tra cứu đặt phòng — Emily Hotel" },
    { name: "description", content: "Tra cứu đặt phòng bằng mã đặt phòng và email." },
    { property: "og:title", content: "Tra cứu đặt phòng — Emily Hotel" },
    { property: "og:description", content: "Tra cứu đặt phòng của bạn." },
  ] }),
  component: Lookup,
});

function Lookup() {
  const { code: initial = "" } = Route.useSearch();
  const { data, guest, roomType, room } = useLookup();
  const [code, setCode] = useState(initial);
  const [email, setEmail] = useState(initial ? guest(data.bookings.find((b) => b.id === initial)?.guestId ?? "")?.email ?? "" : "");
  const [submitted, setSubmitted] = useState(!!initial);
  const [err, setErr] = useState("");
  const b = submitted ? data.bookings.find((x) => x.id.toLowerCase() === code.trim().toLowerCase() && guest(x.guestId)?.email.toLowerCase() === email.trim().toLowerCase()) : undefined;

  return (
    <SiteLayout>
      <div className="mx-auto grid max-w-5xl gap-10 px-5 py-16 md:grid-cols-2 lg:px-8">
        <div>
          <h1 className="font-display text-5xl">Tra cứu đặt phòng</h1>
          <p className="mt-3 text-muted-foreground">Nhập mã đặt phòng trong email xác nhận. Thử <b>BK2402</b> với <b>quoc.bao@mail.com</b>.</p>
          <form className="mt-8 grid gap-4" onSubmit={(e) => { e.preventDefault(); if (!code || !email) { setErr("Vui lòng nhập cả hai ô"); return; } setErr(""); setSubmitted(true); }}>
            <div className="grid gap-1.5"><Label htmlFor="code">Mã đặt phòng</Label><Input id="code" value={code} onChange={(e) => { setCode(e.target.value); setSubmitted(false); }} placeholder="BK2401" /></div>
            <div className="grid gap-1.5"><Label htmlFor="em">Email</Label><Input id="em" type="email" value={email} onChange={(e) => { setEmail(e.target.value); setSubmitted(false); }} /></div>
            {err && <p className="text-sm text-destructive">{err}</p>}
            <Button type="submit" className="w-fit rounded-full">Tra cứu</Button>
          </form>
        </div>
        <div>
          {submitted && !b && <EmptyState icon={SearchX} title="Không tìm thấy đặt phòng" body="Kiểm tra lại mã đặt phòng và email đã dùng khi đặt." />}
          {b && (
            <div className="card-soft overflow-hidden">
              <img src={roomType(b.roomId)?.image} alt="" className="h-44 w-full object-cover" />
              <div className="divide-y p-5">
                <div className="flex items-center justify-between pb-3"><span className="font-display text-2xl">{roomType(b.roomId)?.name}</span><StatusBadge status={b.status} /></div>
                <KV k="Mã đặt phòng" v={b.id} /><KV k="Khách" v={guest(b.guestId)?.name} /><KV k="Phòng" v={room(b.roomId)?.number} />
                <KV k="Ngày" v={`${fdate(b.checkIn)} → ${fdate(b.checkOut)}`} /><KV k="Tổng" v={vnd(b.total)} /><KV k="Đã thanh toán" v={vnd(b.paid)} />
              </div>
            </div>
          )}
        </div>
      </div>
    </SiteLayout>
  );
}
