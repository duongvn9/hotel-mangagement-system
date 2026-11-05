import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Check, Clock, CreditCard, Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { SiteLayout } from "@/components/hms/SiteLayout";
import { EmptyState, KV } from "@/components/hms/ui";
import { useStore, freeRooms, newId, useHydrated } from "@/lib/store";
import { day, nights } from "@/lib/mock";
import { vnd, fdate } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/book/$typeId")({
  validateSearch: (s: Record<string, unknown>): { from?: string; to?: string; guests?: number } => ({ from: (s.from as string) || undefined, to: (s.to as string) || undefined, guests: Number(s.guests) || undefined }),
  head: () => ({ meta: [
    { title: "Hoàn tất đặt phòng — Emily Hotel" },
    { name: "description", content: "Giữ phòng, điền thông tin khách và thanh toán cọc." },
    { property: "og:title", content: "Hoàn tất đặt phòng — Emily Hotel" },
    { property: "og:description", content: "Giữ phòng chỉ với ba bước." },
  ] }),
  component: Book,
});

const HOLD = 600;
const steps = ["Đã giữ phòng", "Thông tin khách", "Tiền cọc"];

function Book() {
  const { typeId } = Route.useParams();
  const { from = day(3), to = day(6), guests = 2 } = Route.useSearch();
  const navigate = useNavigate();
  const st = useStore();
  const t = st.data.roomTypes.find((x) => x.id === typeId);
  const me = st.role === "CUSTOMER" ? st.data.guests.find((g) => g.id === st.customerId) : undefined;
  const [step, setStep] = useState(0);
  const [left, setLeft] = useState(HOLD);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: me?.name ?? "", email: me?.email ?? "", phone: me?.phone ?? "", idNumber: me?.idNumber ?? "", notes: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [method, setMethod] = useState("VNPAY");
  const started = useRef(false);
  const hydrated = useHydrated();
  const [soldOut, setSoldOut] = useState(false);
  const n = nights(from, to);

  // create a ROOM_HELD booking once
  useEffect(() => {
    if (!hydrated || started.current || !t) return;
    started.current = true;
    const room = freeRooms(useStore.getState().data, t.id, from, to)[0];
    if (!room) { setSoldOut(true); return; }
    const id = newId("BK");
    const total = t.price * n;
    useStore.getState().createBooking({ id, guestId: me?.id ?? "pending", roomId: room.id, checkIn: from, checkOut: to, guests, status: "ROOM_HELD", source: "ONLINE", total, deposit: Math.round(total * 0.3), paid: 0, createdAt: day(0) });
    setBookingId(id);
  }, [hydrated, t, from, to, guests, n, me?.id]);

  useEffect(() => {
    if (!bookingId) return;
    const i = setInterval(() => setLeft((l) => {
      if (l <= 1) { clearInterval(i); useStore.getState().patch("bookings", bookingId, { status: "EXPIRED" }); return 0; }
      return l - 1;
    }), 1000);
    return () => clearInterval(i);
  }, [bookingId]);

  if (!t) return <SiteLayout><div className="mx-auto max-w-xl p-10"><EmptyState title="Không tìm thấy loại phòng" action={<Button asChild><Link to="/rooms">Xem phòng</Link></Button>} /></div></SiteLayout>;
  if (soldOut) return <SiteLayout><div className="mx-auto max-w-xl p-10"><EmptyState title="Đã hết phòng trong những ngày này" body="Khách khác vừa đặt phòng cuối cùng. Hãy thử ngày khác." action={<Button asChild className="rounded-full"><Link to="/rooms">Đổi ngày</Link></Button>} /></div></SiteLayout>;
  const total = t.price * n;
  const deposit = Math.round(total * 0.3);

  const validate = () => {
    const e: Record<string, string> = {};
    if (form.name.trim().length < 2) e.name = "Hãy nhập họ tên khách";
    if (!/^\S+@\S+\.\S+$/.test(form.email)) e.email = "Email không hợp lệ";
    if (!/^[+\d\s]{9,15}$/.test(form.phone)) e.phone = "Số điện thoại không hợp lệ";
    if (form.idNumber.trim().length < 6) e.idNumber = "Cần nhập số CCCD / hộ chiếu";
    setErrors(e);
    return !Object.keys(e).length;
  };

  const pay = (success: boolean) => {
    const s = useStore.getState();
    let guestId = me?.id;
    if (!guestId) { guestId = newId("g"); s.upsert("guests", { id: guestId, name: form.name, email: form.email, phone: form.phone, idNumber: form.idNumber, nationality: "Vietnam" }); }
    s.patch("bookings", bookingId!, { guestId, notes: form.notes || undefined, status: success ? "CONFIRMED" : "PENDING_DEPOSIT", paid: success ? deposit : 0 });
    s.upsert("payments", { id: newId("PM"), bookingId: bookingId!, amount: deposit, method: method as any, status: success ? "SUCCESS" : "FAILED", reconciled: false, date: day(0) });
    navigate({ to: "/payment-return", search: { booking: bookingId!, status: success ? "success" : "failed" } });
  };

  const expired = left === 0;
  return (
    <SiteLayout>
      <div className="mx-auto max-w-6xl px-5 py-10 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="font-display text-5xl">Hoàn tất đặt phòng</h1>
          <div className={cn("flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium", left < 120 ? "bg-danger/10 text-danger" : "bg-surface")}>
            <Clock className="size-4" /> Giữ phòng còn {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}
          </div>
        </div>
        <ol className="mt-8 flex gap-2">
          {steps.map((s, i) => (
            <li key={s} className="flex flex-1 items-center gap-2">
              <span className={cn("grid size-7 place-items-center rounded-full text-xs font-semibold", i < step ? "bg-primary text-primary-foreground" : i === step ? "bg-ink text-ink-foreground" : "bg-surface text-muted-foreground")}>{i < step ? <Check className="size-3.5" /> : i + 1}</span>
              <span className={cn("text-sm", i === step ? "font-medium" : "text-muted-foreground")}>{s}</span>
              {i < steps.length - 1 && <span className="mx-2 h-px flex-1 bg-border" />}
            </li>
          ))}
        </ol>

        {expired ? (
          <div className="mt-10"><EmptyState icon={Clock} title="Thời gian giữ phòng đã hết" body="Phòng đã được mở lại cho khách khác. Hãy bắt đầu lại để giữ phòng." action={<Button asChild className="rounded-full"><Link to="/rooms" search={{ from, to, guests }}>Tìm lại</Link></Button>} /></div>
        ) : (
          <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
            <div className="card-soft p-6">
              {step === 0 && (
                <div>
                  <h2 className="text-lg font-semibold">Chúng tôi đang giữ phòng {t.name} cho bạn</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Vui lòng hoàn tất thông tin và đặt cọc trong 10 phút. Mã đặt phòng <b className="text-foreground">{bookingId}</b>.</p>
                  <Button className="mt-6 rounded-full" onClick={() => setStep(1)}>Tiếp tục điền thông tin</Button>
                </div>
              )}
              {step === 1 && (
                <div className="grid gap-4 sm:grid-cols-2">
                  {([["name", "Họ và tên"], ["email", "Email"], ["phone", "Điện thoại"], ["idNumber", "Số CCCD / hộ chiếu"]] as const).map(([k, l]) => (
                    <div key={k} className="grid gap-1.5">
                      <Label htmlFor={k}>{l}</Label>
                      <Input id={k} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} aria-invalid={!!errors[k]} />
                      {errors[k] && <p className="text-xs text-destructive">{errors[k]}</p>}
                    </div>
                  ))}
                  <div className="grid gap-1.5 sm:col-span-2"><Label htmlFor="notes">Yêu cầu đặc biệt (không bắt buộc)</Label><Textarea id="notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
                  <div className="flex gap-2 sm:col-span-2">
                    <Button variant="outline" className="rounded-full" onClick={() => setStep(0)}>Quay lại</Button>
                    <Button className="rounded-full" onClick={() => validate() ? setStep(2) : toast.error("Vui lòng sửa các ô được đánh dấu")}>Tiếp tục đặt cọc</Button>
                  </div>
                </div>
              )}
              {step === 2 && (
                <div>
                  <h2 className="text-lg font-semibold">Thanh toán cọc 30%</h2>
                  <RadioGroup value={method} onValueChange={setMethod} className="mt-4 grid gap-3">
                    {[["VNPAY", "VNPay", "Ứng dụng ngân hàng, QR hoặc thẻ nội địa"], ["CARD", "Thẻ quốc tế", "Visa, Mastercard, JCB"]].map(([v, l, d]) => (
                      <Label key={v} htmlFor={v} className={cn("flex cursor-pointer items-center gap-3 rounded-xl border p-4", method === v && "border-primary bg-primary/5")}>
                        <RadioGroupItem value={v} id={v} /><CreditCard className="size-4 text-primary" /><span><span className="block font-medium">{l}</span><span className="text-xs font-normal text-muted-foreground">{d}</span></span>
                      </Label>
                    ))}
                  </RadioGroup>
                  <div className="mt-6 rounded-xl bg-surface p-4 text-xs text-muted-foreground"><Lock className="mr-1 inline size-3" /> Cổng thanh toán mô phỏng — chọn kết quả để thử.</div>
                  <div className="mt-6 flex flex-wrap gap-2">
                    <Button variant="outline" className="rounded-full" onClick={() => setStep(1)}>Quay lại</Button>
                    <Button className="rounded-full" onClick={() => pay(true)}>Thanh toán {vnd(deposit)}</Button>
                    <Button variant="ghost" className="rounded-full text-destructive" onClick={() => pay(false)}>Mô phỏng thanh toán thất bại</Button>
                  </div>
                </div>
              )}
            </div>
            <aside className="card-soft h-fit overflow-hidden">
              <img src={t.image} alt={t.name} className="h-40 w-full object-cover" />
              <div className="divide-y p-5">
                <div className="pb-3 font-display text-2xl">{t.name}</div>
                <KV k="Nhận phòng" v={fdate(from)} /><KV k="Trả phòng" v={fdate(to)} /><KV k="Số khách" v={guests} />
                <KV k={`${n} đêm`} v={vnd(total)} /><KV k="Đặt cọc hôm nay" v={<span className="text-primary">{vnd(deposit)}</span>} /><KV k="Thanh toán khi trả phòng" v={vnd(total - deposit)} />
              </div>
            </aside>
          </div>
        )}
      </div>
    </SiteLayout>
  );
}
