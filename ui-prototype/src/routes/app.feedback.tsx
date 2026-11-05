import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, Panel, EmptyState, Stars } from "@/components/hms/ui";
import { useLookup, useStore, newId } from "@/lib/store";
import { day } from "@/lib/mock";
import { fdate } from "@/lib/format";

export const Route = createFileRoute("/app/feedback")({
  head: () => ({ meta: [{ title: "Đánh giá — Emily Hotel" }, { name: "description", content: "Đánh giá kỳ nghỉ của bạn." }, { property: "og:title", content: "Đánh giá" }, { property: "og:description", content: "Chia sẻ trải nghiệm" }] }),
  component: FeedbackPage,
});

function FeedbackPage() {
  const { data, roomType } = useLookup();
  const me = useStore((s) => s.customerId);
  const done = data.bookings.filter((b) => b.guestId === me && b.status === "CHECKED_OUT" && !data.feedback.some((f) => f.bookingId === b.id));
  const mine = data.feedback.filter((f) => f.guestId === me);
  const [bk, setBk] = useState("");
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const submit = () => {
    if (!bk) return toast.error("Hãy chọn kỳ lưu trú để đánh giá");
    if (!rating) return toast.error("Vui lòng chọn số sao");
    if (comment.trim().length < 10) return toast.error("Hãy chia sẻ thêm một chút (từ 10 ký tự)");
    useStore.getState().upsert("feedback", { id: newId("F"), bookingId: bk, guestId: me, rating, comment, date: day(0) });
    toast.success("Cảm ơn bạn đã đánh giá"); setBk(""); setRating(0); setComment("");
  };
  return (
    <div>
      <PageHeader title="Đánh giá" subtitle="Hãy kể về kỳ nghỉ của bạn — ban quản lý đọc mọi đánh giá." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Viết đánh giá">
          {done.length === 0 ? <EmptyState title="Chưa có gì để đánh giá" body="Sau khi trả phòng, bạn có thể đánh giá kỳ nghỉ tại đây." /> : (
            <div className="grid gap-4">
              <Select value={bk} onValueChange={setBk}><SelectTrigger><SelectValue placeholder="Chọn kỳ lưu trú đã hoàn thành" /></SelectTrigger><SelectContent>{done.map((b) => <SelectItem key={b.id} value={b.id}>{b.id} · {roomType(b.roomId)?.name} · {fdate(b.checkOut)}</SelectItem>)}</SelectContent></Select>
              <Stars value={rating} onChange={setRating} />
              <Textarea rows={5} placeholder="Điều gì ấn tượng? Điều gì cần cải thiện?" value={comment} onChange={(e) => setComment(e.target.value)} />
              <Button className="w-fit rounded-full" onClick={submit}>Gửi đánh giá</Button>
            </div>
          )}
        </Panel>
        <Panel title="Đánh giá của tôi">
          {mine.length === 0 ? <p className="text-sm text-muted-foreground">Bạn chưa có đánh giá nào.</p> : mine.map((f) => (
            <div key={f.id} className="border-b py-4 first:pt-0 last:border-0">
              <div className="flex items-center justify-between"><Stars value={f.rating} /><span className="text-xs text-muted-foreground">{f.bookingId} · {fdate(f.date)}</span></div>
              <p className="mt-2 text-sm">{f.comment}</p>
              {f.reply && <p className="mt-2 rounded-lg bg-surface p-3 text-sm text-muted-foreground"><b className="text-foreground">Khách sạn phản hồi:</b> {f.reply}</p>}
            </div>
          ))}
        </Panel>
      </div>
    </div>
  );
}
