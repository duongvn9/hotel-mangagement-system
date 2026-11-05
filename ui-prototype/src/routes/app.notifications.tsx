import { createFileRoute } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, Proposed, EmptyState } from "@/components/hms/ui";
import { useStore } from "@/lib/store";
import { fdate } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/notifications")({
  head: () => ({ meta: [{ title: "Thông báo — Emily Hotel" }, { name: "description", content: "Hoạt động gần đây." }, { property: "og:title", content: "Thông báo" }, { property: "og:description", content: "Dòng hoạt động" }] }),
  component: Notifications,
});

function Notifications() {
  const role = useStore((s) => s.role);
  const all = useStore((s) => s.data.notifications);
  const list = all.filter((n) => n.roles.includes(role));
  const markAll = () => list.forEach((n) => useStore.getState().patch("notifications", n.id, { read: true }));
  return (
    <div>
      <PageHeader eyebrow={<Proposed />} title="Thông báo" subtitle="Hộp thư chung cho các cảnh báo mà hệ thống đang gửi." actions={<Button variant="outline" className="rounded-full" onClick={markAll}>Đánh dấu tất cả đã đọc</Button>} />
      {list.length === 0 ? <EmptyState icon={Bell} title="Bạn đã xem hết thông báo" /> : (
        <div className="card-soft divide-y">
          {list.map((n) => (
            <button key={n.id} onClick={() => useStore.getState().patch("notifications", n.id, { read: true })} className="flex w-full items-start gap-4 p-5 text-left hover:bg-surface/50">
              <span className={cn("mt-1.5 size-2 rounded-full", n.read ? "bg-border" : "bg-primary")} />
              <div className="flex-1"><div className={cn("text-sm", !n.read && "font-semibold")}>{n.title}</div><div className="text-sm text-muted-foreground">{n.body}</div></div>
              <span className="text-xs text-muted-foreground">{fdate(n.date)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
