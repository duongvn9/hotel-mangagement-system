import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Users, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateRangeField } from "./DateRangeField";
import { day } from "@/lib/mock";

export function SearchBar({ compact }: { compact?: boolean }) {
  const navigate = useNavigate();
  const [from, setFrom] = useState(day(3));
  const [to, setTo] = useState(day(6));
  const [guests, setGuests] = useState("2");
  return (
    <div className={`card-soft flex flex-col gap-3 p-3 md:flex-row md:items-center md:rounded-full md:p-2 md:pl-6 ${compact ? "" : "shadow-lift"}`}>
      <DateRangeField from={from} to={to} onChange={(a, b) => { setFrom(a); setTo(b); }} className="flex-1 rounded-xl px-2 py-1.5 md:px-0" />
      <div className="hidden h-10 w-px bg-border md:block" />
      <div className="flex items-center gap-3 px-2 md:w-48">
        <Users className="size-4 text-primary" />
        <div className="flex-1">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Số khách</div>
          <Select value={guests} onValueChange={setGuests}>
            <SelectTrigger className="h-6 border-0 p-0 text-sm font-medium shadow-none focus:ring-0"><SelectValue /></SelectTrigger>
            <SelectContent>{[1, 2, 3, 4].map((n) => <SelectItem key={n} value={String(n)}>{n} khách</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <Button size="lg" className="h-12 rounded-full px-7" onClick={() => navigate({ to: "/rooms", search: { from, to, guests: Number(guests) } })}>
        <Search className="size-4" /> Kiểm tra phòng trống
      </Button>
    </div>
  );
}

