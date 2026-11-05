import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DataTable } from "@/components/hms/DataTable";
import { PageHeader, KV, StatusBadge } from "@/components/hms/ui";
import { useLookup } from "@/lib/store";
import { fshort } from "@/lib/format";
import type { Guest } from "@/lib/mock";

export const Route = createFileRoute("/app/guests")({
  head: () => ({ meta: [{ title: "Tra cứu khách — Emily Hotel" }, { name: "description", content: "Tìm khách và lịch sử lưu trú." }, { property: "og:title", content: "Tra cứu khách" }, { property: "og:description", content: "Hồ sơ khách" }] }),
  component: Guests,
});

function Guests() {
  const { data, room } = useLookup();
  const [open, setOpen] = useState<Guest | null>(null);
  const stays = (id: string) => data.bookings.filter((b) => b.guestId === id);
  return (
    <div>
      <PageHeader title="Tra cứu khách" subtitle="Tìm theo tên, số điện thoại, email hoặc số CCCD." />
      <DataTable<Guest> rows={data.guests} search={(g) => `${g.name} ${g.phone} ${g.email} ${g.idNumber}`} onRowClick={setOpen}
        filters={[{ key: "nationality", label: "Quốc tịch", options: [...new Set(data.guests.map((g) => g.nationality))] }]}
        columns={[
          { key: "name", header: "Khách", render: (g) => <span className="font-medium">{g.name}</span> },
          { key: "phone", header: "Điện thoại" }, { key: "email", header: "Email" }, { key: "idNumber", header: "Số CCCD" },
          { key: "stays", header: "Lượt lưu trú", render: (g) => stays(g.id).length, className: "text-right" },
        ]} />
      <Sheet open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent className="overflow-y-auto"><SheetHeader><SheetTitle>{open?.name}</SheetTitle></SheetHeader>
          {open && <div className="px-4">
            <div className="divide-y"><KV k="Điện thoại" v={open.phone} /><KV k="Email" v={open.email} /><KV k="Mã" v={open.idNumber} /><KV k="Quốc tịch" v={open.nationality} /></div>
            <div className="mt-6 text-sm font-semibold">Lượt lưu trú</div>
            <div className="mt-2 divide-y">{stays(open.id).map((b) => <Link key={b.id} to="/app/bookings/$id" params={{ id: b.id }} className="flex items-center justify-between py-2.5 text-sm hover:text-primary"><span>{b.id} · {room(b.roomId)?.number} · {fshort(b.checkIn)}</span><StatusBadge status={b.status} /></Link>)}</div>
          </div>}
        </SheetContent>
      </Sheet>
    </div>
  );
}
