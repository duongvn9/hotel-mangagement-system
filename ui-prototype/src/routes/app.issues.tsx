import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DataTable } from "@/components/hms/DataTable";
import { PageHeader, KV, StatusBadge } from "@/components/hms/ui";
import { useLookup, useStore, newId } from "@/lib/store";
import { day, staffNames, type Issue } from "@/lib/mock";
import { fdate, vnd } from "@/lib/format";

export const Route = createFileRoute("/app/issues")({
  head: () => ({ meta: [{ title: "Sự cố — Emily Hotel" }, { name: "description", content: "Các hỏng hóc được báo và cách xử lý." }, { property: "og:title", content: "Sự cố" }, { property: "og:description", content: "Theo dõi hỏng hóc" }] }),
  component: Issues,
});

function Issues() {
  const { data, room } = useLookup();
  const role = useStore((s) => s.role);
  const [openId, setOpenId] = useState<string | null>(null);
  const [fix, setFix] = useState({ action: "", cost: "" });
  const open = data.issues.find((i) => i.id === openId);
  const s = useStore.getState;
  const resolve = (i: Issue) => {
    if (fix.action.trim().length < 4) return toast.error("Hãy mô tả công việc đã làm");
    s().patch("issues", i.id, { status: "RESOLVED" });
    if (i.equipmentId) { s().patch("equipment", i.equipmentId, { condition: "GOOD", lastService: day(0) }); s().upsert("maintenance", { id: newId("M"), equipmentId: i.equipmentId, issueId: i.id, date: day(0), technician: i.assignee ?? "Bùi Tiến", action: fix.action, cost: Number(fix.cost) || 0 }); }
    if (data.rooms.find((r) => r.id === i.roomId)?.status === "MAINTENANCE") s().patch("rooms", i.roomId, { status: "CLEANING" });
    toast.success(`Đã xử lý ${i.id}${i.equipmentId ? " · đã ghi vào lịch sử bảo trì" : ""}`); setFix({ action: "", cost: "" });
  };
  return (
    <div>
      <PageHeader title="Sự cố" subtitle="Hỏng hóc do khách và nhân viên báo." actions={<Button asChild className="rounded-full"><Link to="/app/report-issue"><Plus className="size-4" />Báo hỏng hóc</Link></Button>} />
      <DataTable<Issue> rows={data.issues} onRowClick={(i) => setOpenId(i.id)} search={(i) => `${i.id} ${i.title} ${room(i.roomId)?.number}`}
        filters={[{ key: "status", label: "Trạng thái", options: ["REPORTED", "IN_PROGRESS", "RESOLVED"] }, { key: "severity", label: "Mức độ", options: ["HIGH", "MEDIUM", "LOW"] }]}
        columns={[
          { key: "id", header: "Mã", render: (i) => <span className="font-medium">{i.id}</span> },
          { key: "title", header: "Sự cố" }, { key: "room", header: "Phòng", render: (i) => room(i.roomId)?.number },
          { key: "by", header: "Người báo", render: (i) => i.reportedBy }, { key: "date", header: "Ngày", render: (i) => fdate(i.createdAt) },
          { key: "sev", header: "Mức độ", render: (i) => <StatusBadge status={i.severity} /> },
          { key: "status", header: "Trạng thái", render: (i) => <StatusBadge status={i.status} /> },
        ]} />
      <Sheet open={!!open} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent className="overflow-y-auto"><SheetHeader><SheetTitle>{open?.title}</SheetTitle></SheetHeader>
          {open && <div className="px-4">
            <p className="text-sm text-muted-foreground">{open.description}</p>
            <div className="mt-4 divide-y"><KV k="Mã" v={open.id} /><KV k="Phòng" v={room(open.roomId)?.number} /><KV k="Thiết bị" v={data.equipment.find((e) => e.id === open.equipmentId)?.name ?? "—"} /><KV k="Mức độ" v={<StatusBadge status={open.severity} />} /><KV k="Trạng thái" v={<StatusBadge status={open.status} />} /></div>
            {open.status !== "RESOLVED" && <div className="mt-6 grid gap-3">
              <div className="grid gap-1.5"><Label>Người phụ trách</Label><Select value={open.assignee ?? ""} disabled={role !== "MANAGER" && role !== "OPERATIONS_STAFF"} onValueChange={(v) => { s().patch("issues", open.id, { assignee: v, status: "IN_PROGRESS" }); toast.success(`Đã giao cho ${v}`); }}><SelectTrigger><SelectValue placeholder="Chọn kỹ thuật viên" /></SelectTrigger><SelectContent>{staffNames.ops.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent></Select></div>
              {open.status === "REPORTED" && <Button variant="outline" className="rounded-full" onClick={() => { s().patch("issues", open.id, { status: "IN_PROGRESS", assignee: open.assignee ?? "Bùi Tiến" }); s().patch("rooms", open.roomId, { status: "MAINTENANCE" }); toast.success("Đã bắt đầu sửa · phòng tạm khoá để bảo trì"); }}>Bắt đầu xử lý</Button>}
              {open.status === "IN_PROGRESS" && <>
                <div className="grid gap-1.5"><Label>Công việc đã làm</Label><Input value={fix.action} onChange={(e) => setFix({ ...fix, action: e.target.value })} placeholder="VD: Đã thay ống thoát nước" /></div>
                <div className="grid gap-1.5"><Label>Chi phí (₫)</Label><Input type="number" value={fix.cost} onChange={(e) => setFix({ ...fix, cost: e.target.value })} /></div>
                {fix.cost && <p className="text-xs text-muted-foreground">{vnd(Number(fix.cost))}</p>}
                <Button className="rounded-full" onClick={() => resolve(open)}>Đánh dấu đã xử lý</Button>
              </>}
            </div>}
          </div>}
        </SheetContent>
      </Sheet>
    </div>
  );
}
