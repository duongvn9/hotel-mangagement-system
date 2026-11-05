import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DataTable } from "@/components/hms/DataTable";
import { PageHeader, StatusBadge, StatCard } from "@/components/hms/ui";
import { useLookup, useStore, newId } from "@/lib/store";
import { day, staffNames, type Task } from "@/lib/mock";
import { fshort, label } from "@/lib/format";

export const Route = createFileRoute("/app/task-queues")({
  head: () => ({ meta: [{ title: "Giám sát công việc — Emily Hotel" }, { name: "description", content: "Giao và điều chuyển công việc nhân viên." }, { property: "og:title", content: "Giám sát công việc" }, { property: "og:description", content: "Hàng đợi công việc" }] }),
  component: Queues,
});

const all = [...staffNames.service, ...staffNames.ops];
function Queues() {
  const { data, room } = useLookup();
  const [nw, setNw] = useState<Partial<Task> | null>(null);
  const reassign = (t: Task, who: string) => { useStore.getState().patch("tasks", t.id, { assignee: who, role: staffNames.ops.includes(who) ? "OPERATIONS_STAFF" : "SERVICE_STAFF" }); toast.success(`Đã chuyển ${t.id} cho ${who}`); };
  return (
    <div>
      <PageHeader title="Giám sát công việc" subtitle="Khối lượng việc của từng nhân viên, có thể điều chuyển." actions={<Button className="rounded-full" onClick={() => setNw({ title: "", roomId: data.rooms[0].id, type: "CLEANING", assignee: all[0], priority: "MEDIUM" })}><Plus className="size-4" />Công việc mới</Button>} />
      <div className="mb-6 grid gap-4 sm:grid-cols-3 lg:grid-cols-5">{all.map((n) => <StatCard key={n} label={n} value={data.tasks.filter((t) => t.assignee === n && t.status !== "DONE").length} hint="việc đang mở" />)}</div>
      <DataTable<Task> rows={data.tasks} search={(t) => `${t.id} ${t.title} ${t.assignee}`}
        filters={[{ key: "status", label: "Trạng thái", options: ["OPEN", "IN_PROGRESS", "DONE"] }, { key: "type", label: "Loại", options: ["CLEANING", "SERVICE", "MAINTENANCE"] }]}
        columns={[
          { key: "id", header: "Mã" }, { key: "title", header: "Công việc", render: (t) => <span className="font-medium">{t.title}</span> },
          { key: "room", header: "Phòng", render: (t) => room(t.roomId)?.number }, { key: "type", header: "Loại", render: (t) => label(t.type) },
          { key: "due", header: "Hạn", render: (t) => fshort(t.due) },
          { key: "who", header: "Người phụ trách", render: (t) => <Select value={t.assignee} onValueChange={(v) => reassign(t, v)} disabled={t.status === "DONE"}><SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger><SelectContent>{all.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent></Select> },
          { key: "status", header: "Trạng thái", render: (t) => <StatusBadge status={t.status} /> },
        ]} />
      <Dialog open={!!nw} onOpenChange={(o) => !o && setNw(null)}>
        <DialogContent><DialogHeader><DialogTitle>Công việc mới</DialogTitle></DialogHeader>
          {nw && <div className="grid gap-4">
            <div className="grid gap-1.5"><Label>Tiêu đề</Label><Input value={nw.title} onChange={(e) => setNw({ ...nw, title: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5"><Label>Phòng</Label><Select value={nw.roomId} onValueChange={(v) => setNw({ ...nw, roomId: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{data.rooms.map((r) => <SelectItem key={r.id} value={r.id}>{r.number}</SelectItem>)}</SelectContent></Select></div>
              <div className="grid gap-1.5"><Label>Loại</Label><Select value={nw.type} onValueChange={(v) => setNw({ ...nw, type: v as any })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["CLEANING", "SERVICE", "MAINTENANCE"].map((x) => <SelectItem key={x} value={x}>{label(x)}</SelectItem>)}</SelectContent></Select></div>
              <div className="grid gap-1.5"><Label>Người phụ trách</Label><Select value={nw.assignee} onValueChange={(v) => setNw({ ...nw, assignee: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{all.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent></Select></div>
              <div className="grid gap-1.5"><Label>Ưu tiên</Label><Select value={nw.priority} onValueChange={(v) => setNw({ ...nw, priority: v as any })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["LOW", "MEDIUM", "HIGH"].map((x) => <SelectItem key={x} value={x}>{label(x)}</SelectItem>)}</SelectContent></Select></div>
            </div>
          </div>}
          <DialogFooter><Button onClick={() => { if (!nw?.title || nw.title.length < 4) return toast.error("Hãy đặt tiêu đề cho công việc"); useStore.getState().upsert("tasks", { ...(nw as Task), id: newId("T"), status: "OPEN", due: day(0), role: staffNames.ops.includes(nw.assignee!) ? "OPERATIONS_STAFF" : "SERVICE_STAFF" }); toast.success("Đã tạo công việc"); setNw(null); }}>Tạo công việc</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
