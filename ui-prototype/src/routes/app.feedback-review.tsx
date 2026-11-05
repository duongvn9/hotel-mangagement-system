import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader, StatCard, Stars } from "@/components/hms/ui";
import { useLookup, useStore } from "@/lib/store";
import { fdate } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/feedback-review")({
  head: () => ({ meta: [{ title: "Đánh giá của khách — Emily Hotel" }, { name: "description", content: "Đọc và phản hồi đánh giá của khách." }, { property: "og:title", content: "Đánh giá của khách" }, { property: "og:description", content: "Đánh giá" }] }),
  component: Review,
});

function Review() {
  const { data, guest } = useLookup();
  const [f, setF] = useState(0);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const list = data.feedback.filter((x) => !f || x.rating === f);
  const avg = data.feedback.reduce((s, x) => s + x.rating, 0) / Math.max(1, data.feedback.length);
  return (
    <div>
      <PageHeader title="Đánh giá của khách" subtitle="Phản hồi đánh giá và phát hiện vấn đề lặp lại." />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Điểm trung bình" value={avg.toFixed(2)} /><StatCard label="Đánh giá" value={data.feedback.length} /><StatCard label="Chờ phản hồi" value={data.feedback.filter((x) => !x.reply).length} />
      </div>
      <div className="mb-4 flex gap-2">{[0, 5, 4, 3, 2, 1].map((n) => <button key={n} onClick={() => setF(n)} className={cn("rounded-full border px-3 py-1.5 text-sm", f === n ? "border-ink bg-ink text-ink-foreground" : "bg-card")}>{n ? `${n}★` : "Tất cả"}</button>)}</div>
      <div className="grid gap-4 md:grid-cols-2">
        {list.map((x) => (
          <div key={x.id} className="card-soft p-5">
            <div className="flex items-center justify-between"><Stars value={x.rating} /><span className="text-xs text-muted-foreground">{x.bookingId} · {fdate(x.date)}</span></div>
            <p className="mt-3">{x.comment}</p><p className="mt-1 text-sm text-muted-foreground">— {guest(x.guestId)?.name}</p>
            {x.reply ? <p className="mt-3 rounded-lg bg-surface p-3 text-sm"><b>Phản hồi:</b> {x.reply}</p> : (
              <div className="mt-3 grid gap-2"><Textarea placeholder="Viết phản hồi…" value={draft[x.id] ?? ""} onChange={(e) => setDraft({ ...draft, [x.id]: e.target.value })} />
                <Button size="sm" className="w-fit rounded-full" onClick={() => { if (!draft[x.id]?.trim()) return toast.error("Phản hồi không được để trống"); useStore.getState().patch("feedback", x.id, { reply: draft[x.id] }); toast.success("Đã đăng phản hồi"); }}>Đăng phản hồi</Button></div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
