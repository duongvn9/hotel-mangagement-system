import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader, StatusBadge, EmptyState } from "@/components/hms/ui";
import { useLookup, useStore } from "@/lib/store";
import { roleMeta } from "@/lib/nav";
import { fshort } from "@/lib/format";
import type { Task } from "@/lib/mock";

export const Route = createFileRoute("/app/tasks")({
  head: () => ({ meta: [{ title: "Công việc được giao — Emily Hotel" }, { name: "description", content: "Bảng công việc của bạn." }, { property: "og:title", content: "Công việc được giao" }, { property: "og:description", content: "Bảng công việc" }] }),
  component: Tasks,
});

const cols: { s: Task["status"]; t: string }[] = [{ s: "OPEN", t: "Cần làm" }, { s: "IN_PROGRESS", t: "Đang xử lý" }, { s: "DONE", t: "Hoàn thành" }];

function Tasks() {
  const { data, room } = useLookup();
  const role = useStore((s) => s.role);
  const person = roleMeta[role].person;
  const mine = data.tasks.filter((t) => role === "MANAGER" || t.assignee === person);
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<Task["status"] | null>(null);
  const advance = (t: Task) => move(t, t.status === "OPEN" ? "IN_PROGRESS" : "DONE");
  const move = (t: Task, next: Task["status"]) => {
    if (t.status === next) return;
    const s = useStore.getState();
    s.patch("tasks", t.id, { status: next });
    if (next === "DONE" && t.type === "CLEANING") s.patch("rooms", t.roomId, { status: "AVAILABLE" });
    toast.success(next === "DONE" ? (t.type === "CLEANING" ? `Phòng ${room(t.roomId)?.number} đã sẵn sàng đón khách` : "Đã hoàn thành công việc") : next === "IN_PROGRESS" ? "Đã bắt đầu công việc" : "Đã chuyển về cần làm");
  };
  return (
    <div>
      <PageHeader title="Công việc được giao" subtitle={`Công việc giao cho ${person}. Kéo thả thẻ giữa các cột để đổi trạng thái.`} />
      {mine.length === 0 ? <EmptyState title="Chưa có công việc được giao" /> : (
        <div className="grid gap-4 lg:grid-cols-3">
          {cols.map((c) => (
            <div key={c.s}
              onDragOver={(e) => { e.preventDefault(); setOver(c.s); }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(null); }}
              onDrop={(e) => { e.preventDefault(); const t = mine.find((x) => x.id === dragId); if (t) move(t, c.s); setDragId(null); setOver(null); }}
              className={cn("min-h-[240px] rounded-2xl bg-surface/60 p-3 ring-2 ring-transparent transition", over === c.s && "bg-primary/10 ring-primary/40")}>
              <div className="mb-3 flex items-center justify-between px-2 text-sm font-semibold">{c.t}<span className="text-muted-foreground">{mine.filter((t) => t.status === c.s).length}</span></div>
              <div className="grid gap-3">
                {over === c.s && dragId && mine.find((x) => x.id === dragId)?.status !== c.s && <div className="rounded-xl border-2 border-dashed border-primary/40 py-6 text-center text-xs text-primary">Thả vào đây</div>}
                {mine.filter((t) => t.status === c.s).map((t) => (
                  <div key={t.id} draggable
                    onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; setDragId(t.id); }}
                    onDragEnd={() => { setDragId(null); setOver(null); }}
                    className={cn("card-soft cursor-grab p-4 transition active:cursor-grabbing", dragId === t.id && "rotate-1 opacity-50")}>
                    <div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">{t.id} · Phòng {room(t.roomId)?.number}</span><StatusBadge status={t.priority} /></div>
                    <div className="mt-2 font-medium">{t.title}</div>
                    <div className="mt-1 text-xs text-muted-foreground">Hạn {fshort(t.due)} · {t.assignee}</div>
                    {t.status !== "DONE" && <Button size="sm" variant={t.status === "OPEN" ? "outline" : "default"} className="mt-3 rounded-full" onClick={() => advance(t)}>{t.status === "OPEN" ? "Bắt đầu" : "Hoàn thành"}</Button>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
