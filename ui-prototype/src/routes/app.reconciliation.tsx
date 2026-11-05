import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTable } from "@/components/hms/DataTable";
import { PageHeader, StatCard, StatusBadge } from "@/components/hms/ui";
import { useLookup, useStore } from "@/lib/store";
import { vnd, fdate, label } from "@/lib/format";
import type { Payment } from "@/lib/mock";

export const Route = createFileRoute("/app/reconciliation")({
  head: () => ({ meta: [{ title: "Đối soát thanh toán — Emily Hotel" }, { name: "description", content: "Đối chiếu thanh toán với cổng thanh toán." }, { property: "og:title", content: "Đối soát" }, { property: "og:description", content: "Thanh toán" }] }),
  component: Recon,
});

function Recon() {
  const { data, booking, guest } = useLookup();
  const pending = data.payments.filter((p) => p.status === "SUCCESS" && !p.reconciled);
  const sum = (xs: Payment[]) => vnd(xs.reduce((s, p) => s + p.amount, 0));
  const mark = (p: Payment, v: boolean) => useStore.getState().patch("payments", p.id, { reconciled: v });
  return (
    <div>
      <PageHeader title="Đối soát thanh toán" subtitle="Đánh dấu từng giao dịch khi đã khớp với sao kê ngân hàng hoặc VNPay."
        actions={<Button className="rounded-full" disabled={!pending.length} onClick={() => { pending.forEach((p) => mark(p, true)); toast.success(`Đã đối soát ${pending.length} giao dịch`); }}><CheckCheck className="size-4" />Đối soát tất cả</Button>} />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Đã thu" value={sum(data.payments.filter((p) => p.status === "SUCCESS"))} />
        <StatCard label="Chờ đối soát" value={sum(pending)} hint={`${pending.length} giao dịch`} />
        <StatCard label="Giao dịch thất bại" value={data.payments.filter((p) => p.status === "FAILED").length} />
      </div>
      <DataTable<Payment> rows={data.payments} search={(p) => `${p.id} ${p.bookingId} ${guest(booking(p.bookingId)?.guestId ?? "")?.name}`}
        filters={[{ key: "method", label: "Phương thức", options: ["VNPAY", "CASH", "CARD"] }, { key: "status", label: "Trạng thái", options: ["SUCCESS", "FAILED", "PENDING"] }, { key: "reconciled", label: "Đối soát", options: ["true", "false"] }]}
        columns={[
          { key: "ok", header: "", className: "w-10", render: (p) => <Checkbox disabled={p.status !== "SUCCESS"} checked={p.reconciled} onCheckedChange={(v) => mark(p, !!v)} aria-label="Đối soát" /> },
          { key: "id", header: "Giao dịch", render: (p) => <span className="font-medium">{p.id}</span> },
          { key: "bk", header: "Đặt phòng", render: (p) => <Link to="/app/bookings/$id" params={{ id: p.bookingId }} className="text-primary">{p.bookingId}</Link> },
          { key: "guest", header: "Khách", render: (p) => guest(booking(p.bookingId)?.guestId ?? "")?.name ?? "—" },
          { key: "method", header: "Phương thức", render: (p) => label(p.method) },
          { key: "date", header: "Ngày", render: (p) => fdate(p.date) },
          { key: "amount", header: "Số tiền", render: (p) => vnd(p.amount), className: "text-right" },
          { key: "status", header: "Trạng thái", render: (p) => <StatusBadge status={p.status} /> },
        ]} />
    </div>
  );
}
