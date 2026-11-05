import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, Panel, EmptyState } from "@/components/hms/ui";
import { useLookup, useStore, newId } from "@/lib/store";
import { day } from "@/lib/mock";
import { label } from "@/lib/format";
import { roleMeta } from "@/lib/nav";

export const Route = createFileRoute("/app/report-issue")({
  head: () => ({ meta: [{ title: "Báo sự cố — Emily Hotel" }, { name: "description", content: "Báo hỏng hóc trong phòng." }, { property: "og:title", content: "Báo sự cố" }, { property: "og:description", content: "Báo hỏng hóc" }] }),
  component: ReportIssue,
});

function ReportIssue() {
  const { data, room } = useLookup();
  const role = useStore((s) => s.role);
  const me = useStore((s) => s.customerId);
  const navigate = useNavigate();
  const stay = data.bookings.find((b) => b.guestId === me && b.status === "CHECKED_IN");
  const isGuest = role === "CUSTOMER";
  const [f, setF] = useState({ roomId: isGuest ? stay?.roomId ?? "" : "", equipmentId: "", title: "", severity: "MEDIUM", description: "" });
  const [sent, setSent] = useState<string | null>(null);
  const eq = data.equipment.filter((e) => e.roomId === f.roomId);

  if (isGuest && !stay) return <div><PageHeader title="Báo sự cố" /><EmptyState title="Chỉ dùng được khi đang lưu trú" body="Bạn có thể báo sự cố khi đang lưu trú." /></div>;
  if (sent) return <div className="py-10"><EmptyState icon={CheckCircle2} title={`Đã báo sự cố ${sent}`} body="Bộ phận vận hành đã nhận thông báo và sẽ xử lý sớm." action={<Button className="rounded-full" onClick={() => role === "OPERATIONS_STAFF" ? navigate({ to: "/app/issues" }) : setSent(null)}>{role === "OPERATIONS_STAFF" ? "Đến danh sách sự cố" : "Báo sự cố khác"}</Button>} /></div>;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.roomId || f.title.trim().length < 4 || f.description.trim().length < 10) return toast.error("Cần chọn phòng, nhập tiêu đề và mô tả (từ 10 ký tự)");
    const id = newId("IS");
    useStore.getState().upsert("issues", { id, title: f.title, roomId: f.roomId, reportedBy: isGuest ? `Khách phòng ${room(f.roomId)?.number}` : roleMeta[role].person, severity: f.severity as any, status: "REPORTED", createdAt: day(0), description: f.description, equipmentId: f.equipmentId || undefined });
    if (f.equipmentId) useStore.getState().patch("equipment", f.equipmentId, { condition: "NEEDS_REPAIR" });
    setSent(id);
  };
  return (
    <div>
      <PageHeader title={isGuest ? "Báo sự cố" : "Báo hỏng hóc"} subtitle="Cho chúng tôi biết vấn đề, chúng tôi sẽ cử người đến xử lý." />
      <Panel>
        <form className="grid max-w-2xl gap-4" onSubmit={submit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5"><Label>Phòng</Label>
              <Select value={f.roomId} onValueChange={(v) => setF({ ...f, roomId: v, equipmentId: "" })} disabled={isGuest}><SelectTrigger><SelectValue placeholder="Chọn phòng" /></SelectTrigger><SelectContent>{data.rooms.map((r) => <SelectItem key={r.id} value={r.id}>Phòng {r.number}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-1.5"><Label>Thiết bị (không bắt buộc)</Label>
              <Select value={f.equipmentId} onValueChange={(v) => setF({ ...f, equipmentId: v })}><SelectTrigger><SelectValue placeholder={eq.length ? "Chọn thiết bị" : "Không có thiết bị"} /></SelectTrigger><SelectContent>{eq.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <div className="grid gap-1.5"><Label htmlFor="t">Tiêu đề</Label><Input id="t" placeholder="VD: Vòi sen không có nước nóng" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
          {!isGuest && <div className="grid gap-1.5"><Label>Mức độ</Label><Select value={f.severity} onValueChange={(v) => setF({ ...f, severity: v })}><SelectTrigger className="w-48"><SelectValue /></SelectTrigger><SelectContent>{["LOW", "MEDIUM", "HIGH"].map((s) => <SelectItem key={s} value={s}>{label(s)}</SelectItem>)}</SelectContent></Select></div>}
          <div className="grid gap-1.5"><Label htmlFor="d">Mô tả</Label><Textarea id="d" rows={5} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
          <Button className="w-fit rounded-full">Gửi báo cáo</Button>
        </form>
      </Panel>
    </div>
  );
}
