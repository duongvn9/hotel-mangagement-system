import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Search, ChevronLeft, ChevronRight, SearchX } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { label } from "@/lib/format";
import { EmptyState } from "./ui";

export interface Column<T> { key: string; header: string; render?: (row: T) => ReactNode; className?: string }
export interface Filter<T> { key: string; label: string; options: string[]; get?: (row: T) => string }

export function DataTable<T extends { id: string }>({
  rows, columns, search, filters = [], pageSize = 8, onRowClick, toolbar, empty,
}: {
  rows: T[]; columns: Column<T>[]; search?: (row: T) => string; filters?: Filter<T>[]; pageSize?: number;
  onRowClick?: (row: T) => void; toolbar?: ReactNode; empty?: ReactNode;
}) {
  const [q, setQ] = useState("");
  const [f, setF] = useState<Record<string, string>>({});
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  useEffect(() => { const t = setTimeout(() => setLoading(false), 350); return () => clearTimeout(t); }, []);

  const filtered = useMemo(() => rows.filter((r) => {
    if (q && search && !search(r).toLowerCase().includes(q.toLowerCase())) return false;
    return filters.every((fl) => !f[fl.key] || f[fl.key] === "all" || (fl.get ? fl.get(r) : String((r as any)[fl.key])) === f[fl.key]);
  }), [rows, q, f, search, filters]);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const cur = Math.min(page, pages - 1);
  const view = filtered.slice(cur * pageSize, cur * pageSize + pageSize);

  return (
    <div className="card-soft overflow-hidden">
      {(search || filters.length > 0 || toolbar) && (
        <div className="flex flex-col gap-3 border-b p-4 md:flex-row md:items-center">
          {search && (
            <div className="relative md:w-72">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} placeholder="Tìm kiếm…" className="h-9 rounded-full bg-surface/60 pl-9" />
            </div>
          )}
          {filters.map((fl) => (
            <Select key={fl.key} value={f[fl.key] ?? "all"} onValueChange={(v) => { setF({ ...f, [fl.key]: v }); setPage(0); }}>
              <SelectTrigger className="h-9 rounded-full md:w-44"><SelectValue placeholder={fl.label} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả: {fl.label.toLowerCase()}</SelectItem>
                {fl.options.map((o) => <SelectItem key={o} value={o}>{label(o)}</SelectItem>)}
              </SelectContent>
            </Select>
          ))}
          <div className="md:ml-auto flex gap-2">{toolbar}</div>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-surface/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              {columns.map((c) => <th key={c.key} className={cn("px-4 py-3 font-medium", c.className)}>{c.header}</th>)}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 4 }, (_, i) => (
                  <tr key={i} className="border-b last:border-0">{columns.map((c) => <td key={c.key} className="px-4 py-4"><Skeleton className="h-4 w-full max-w-32" /></td>)}</tr>
                ))
              : view.map((r) => (
                  <tr key={r.id} onClick={() => onRowClick?.(r)} className={cn("border-b transition-colors last:border-0", onRowClick && "cursor-pointer hover:bg-surface/50")}>
                    {columns.map((c) => <td key={c.key} className={cn("px-4 py-3.5 align-middle", c.className)}>{c.render ? c.render(r) : String((r as any)[c.key] ?? "")}</td>)}
                  </tr>
                ))}
          </tbody>
        </table>
        {!loading && view.length === 0 && (
          <div className="p-6">{empty ?? <EmptyState icon={SearchX} title="Không có kết quả phù hợp" body="Thử từ khoá khác hoặc bỏ bộ lọc." />}</div>
        )}
      </div>
      <div className="flex items-center justify-between border-t px-4 py-3 text-xs text-muted-foreground">
        <span>{filtered.length} kết quả</span>
        <div className="flex items-center gap-2">
          <span>Trang {cur + 1} / {pages}</span>
          <Button size="icon" variant="outline" className="size-8 rounded-full" disabled={cur === 0} onClick={() => setPage(cur - 1)} aria-label="Trang trước"><ChevronLeft className="size-4" /></Button>
          <Button size="icon" variant="outline" className="size-8 rounded-full" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)} aria-label="Trang sau"><ChevronRight className="size-4" /></Button>
        </div>
      </div>
    </div>
  );
}
