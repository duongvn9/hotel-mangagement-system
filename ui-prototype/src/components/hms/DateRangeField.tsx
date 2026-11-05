import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export function DateRangeField({ from, to, onChange, className }: { from: string; to: string; onChange: (from: string, to: string) => void; className?: string }) {
  const range: DateRange = { from: new Date(from), to: new Date(to) };
  const iso = (d: Date) => format(d, "yyyy-MM-dd");
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className={cn("flex items-center gap-3 text-left", className)}>
          <CalendarIcon className="size-4 text-primary" />
          <span>
            <span className="block text-[11px] uppercase tracking-wider text-muted-foreground">Nhận phòng — Trả phòng</span>
            <span className="text-sm font-medium">{format(range.from!, "EEE, dd/MM", { locale: vi })} — {format(range.to!, "EEE, dd/MM", { locale: vi })}</span>
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar locale={vi} mode="range" numberOfMonths={2} selected={range} disabled={{ before: new Date(new Date().toDateString()) }}
          onSelect={(r) => { if (r?.from) onChange(iso(r.from), iso(r.to && r.to > r.from ? r.to : new Date(r.from.getTime() + 86400000))); }}
          className="pointer-events-auto p-3" />
      </PopoverContent>
    </Popover>
  );
}
