import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useLookup, useStore } from "@/lib/store";
import type { Room, RoomStatus } from "@/lib/mock";
import { fshort, label } from "@/lib/format";
import { cn } from "@/lib/utils";
import { BedDouble } from "lucide-react";
import { PageHeader, StatCard } from "@/components/hms/ui";

export const Route = createFileRoute("/app/room-board")({
  head: () => ({ meta: [{ title: "Sơ đồ trạng thái phòng — Emily Hotel" }, { name: "description", content: "Theo dõi trực tiếp mọi phòng." }, { property: "og:title", content: "Sơ đồ trạng thái phòng" }, { property: "og:description", content: "Trạng thái phòng" }] }),
  component: Board,
});

const meta: Record<RoomStatus, { dot: string; bar: string; text: string }> = {
  AVAILABLE: { dot: "bg-success", bar: "bg-success", text: "text-success" },
  OCCUPIED: { dot: "bg-info", bar: "bg-info", text: "text-info" },
  CLEANING: { dot: "bg-warning", bar: "bg-warning", text: "text-warning" },
  MAINTENANCE: { dot: "bg-danger", bar: "bg-danger", text: "text-danger" },
};
const tint: Record<RoomStatus, string> = { AVAILABLE: "bg-success/10", OCCUPIED: "bg-info/10", CLEANING: "bg-warning/10", MAINTENANCE: "bg-danger/10" };
const STATUSES = ["AVAILABLE", "OCCUPIED", "CLEANING", "MAINTENANCE"] as const;

function Board() {
  const { data, type, guest } = useLookup();
  const [filter, setFilter] = useState<RoomStatus | "ALL">("ALL");
  const [sel, setSel] = useState<Room | null>(null);
  const floors = [...new Set(data.rooms.map((r) => r.floor))];
  const current = (r: Room) => data.bookings.find((b) => b.roomId === r.id && b.status === "CHECKED_IN");
  const counts = (s: RoomStatus) => data.rooms.filter((r) => r.status === s).length;
  const total = data.rooms.length;
  const occ = Math.round((counts("OCCUPIED") / total) * 100);
  const tint: Record<RoomStatus, string> = { AVAILABLE: "bg-success/10 hover:bg-success/15", OCCUPIED: "bg-info/10 hover:bg-info/15", CLEANING: "bg-warning/10 hover:bg-warning/15", MAINTENANCE: "bg-danger/10 hover:bg-danger/15" };
  const short = (n?: string) => (n ?? "").replace("Phòng ", "").replace("Hướng ", "· ");
  return (
    <div>
      <PageHeader title="Sơ đồ trạng thái phòng" subtitle="Nhấn vào một phòng để xem khách và đổi trạng thái." />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Công suất hôm nay" value={`${occ}%`} hint={`${counts("OCCUPIED")}/${total} phòng`} icon={BedDouble} />
        {STATUSES.map((s) => (
          <button key={s} onClick={() => setFilter(filter === s ? "ALL" : s)}
            className={cn("card-soft p-5 text-left transition hover:shadow-lift", filter === s && "ring-2 ring-primary")}>
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><span className={cn("size-2 rounded-full", meta[s].dot)} />{label(s)}</div>
            <div className="mt-3 text-3xl font-semibold tracking-tight">{counts(s)}</div>
            <div className="mt-1 text-xs text-muted-foreground">{filter === s ? "Đang lọc · nhấn để bỏ" : "Nhấn để lọc"}</div>
          </button>
        ))}
      </div>

      <div className="grid gap-4">
        {floors.map((f) => {
          const all = data.rooms.filter((r) => r.floor === f);
          return (
            <div key={f} className="rounded-2xl bg-surface/60 p-3">
              <div className="mb-3 flex items-center justify-between px-2 text-sm font-semibold">Tầng {f}<span className="font-normal text-muted-foreground">{all.filter((r) => r.status === "AVAILABLE").length}/{all.length} trống</span></div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
                {all.map((r) => {
                  const b = current(r);
                  const g = b && guest(b.guestId);
                  const dim = filter !== "ALL" && r.status !== filter;
                  return (
                    <button key={r.id} onClick={() => setSel(r)}
                      className={cn("card-soft flex flex-col p-4 text-left transition hover:shadow-lift", dim && "opacity-30")}>
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-semibold">{r.number}</span>
                        <span className={cn("flex items-center gap-1.5 text-xs font-medium", meta[r.status].text)}><span className={cn("size-1.5 rounded-full", meta[r.status].dot)} />{label(r.status)}</span>
                      </div>
                      <div className="mt-0.5 truncate text-xs text-muted-foreground">{type(r.typeId)?.name}</div>
                      <div className="mt-3 truncate border-t pt-2 text-xs text-muted-foreground">{g ? <><span className="text-foreground">{g.name}</span> · đến {fshort(b!.checkOut)}</> : "—"}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <Dialog open={!!sel} onOpenChange={(o) => !o && setSel(null)}>
        <DialogContent className="gap-0 overflow-hidden rounded-[1.75rem] p-0 sm:max-w-[440px]">
          {sel && (() => { const b = current(sel); const live = data.rooms.find((r) => r.id === sel.id)!; const g = b && guest(b.guestId); return (
            <>
              <div className={cn("px-7 pb-6 pt-7", tint[live.status].split(" ")[0])}>
                <DialogHeader className="space-y-0 text-left">
                  <span className={cn("flex items-center gap-1.5 text-xs font-medium", meta[live.status].text)}><span className={cn("size-1.5 rounded-full", meta[live.status].dot)} />{label(live.status)}</span>
                  <DialogTitle className="pt-3 text-4xl font-semibold tracking-tight">{sel.number}</DialogTitle>
                  <DialogDescription className="pt-2">{type(sel.typeId)?.name} · Tầng {sel.floor}</DialogDescription>
                </DialogHeader>
              </div>
              <div className="px-7 py-6">
                {g ? (
                  <div className="flex items-center gap-3">
                    <span className="grid size-11 place-items-center rounded-full bg-surface font-semibold">{g.name.split(" ").pop()?.[0]}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{g.name}</div>
                      <div className="text-xs text-muted-foreground">{fshort(b!.checkIn)} → {fshort(b!.checkOut)} · {b!.id}</div>
                    </div>
                    <Link to="/app/bookings/$id" params={{ id: b!.id }} className="rounded-full border px-3 py-1.5 text-xs transition hover:bg-surface">Chi tiết</Link>
                  </div>
                ) : <div className="text-sm text-muted-foreground">Không có khách đang lưu trú.</div>}

                <div className="mt-6 border-t pt-5">
                  <div className="mb-3 text-xs text-muted-foreground">Đổi trạng thái</div>
                  <div className="grid grid-cols-2 gap-2">
                    {STATUSES.map((s) => {
                      const on = live.status === s;
                      const off = s === "OCCUPIED" || (!!b && s === "AVAILABLE");
                      return (
                        <button key={s} disabled={off || on} onClick={() => { useStore.getState().patch("rooms", sel.id, { status: s }); toast.success(`Phòng ${sel.number} chuyển sang ${label(s).toLowerCase()}`); }}
                          className={cn("flex items-center gap-2 rounded-full px-4 py-2 text-sm transition",
                            on ? "bg-ink text-ink-foreground" : "bg-surface hover:bg-muted",
                            off && !on && "cursor-not-allowed opacity-35 hover:bg-surface")}>
                          <span className={cn("size-2 rounded-full", meta[s].dot)} />{label(s)}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-4 text-[11px] text-muted-foreground">“Có khách” tự bật khi lễ tân nhận phòng.</p>
                </div>
              </div>
            </>
          ); })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
