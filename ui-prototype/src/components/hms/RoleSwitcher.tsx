import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Check, FlaskConical, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useStore } from "@/lib/store";
import { roleMeta } from "@/lib/nav";
import type { Role } from "@/lib/mock";
import { cn } from "@/lib/utils";

export function RoleSwitcher() {
  const role = useStore((s) => s.role);
  const setRole = useStore((s) => s.setRole);
  const reset = useStore((s) => s.reset);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-sm text-ink-foreground shadow-lift transition hover:scale-[1.02]">
          <FlaskConical className="size-4 text-lavender" />
          <span className="hidden sm:inline text-ink-foreground/60">Đang xem với vai trò</span> {roleMeta[role].label}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-2">
        <div className="px-3 pb-2 pt-2">
          <div className="text-sm font-semibold">Chuyển vai trò (bản mẫu)</div>
          <p className="text-xs text-muted-foreground">Chỉ dùng để demo — người dùng thật không thể tự đổi vai trò.</p>
        </div>
        {(Object.keys(roleMeta) as Role[]).map((r) => (
          <button key={r} onClick={() => { setOpen(false); setRole(r); navigate({ to: roleMeta[r].home }); toast(`Đang xem với vai trò ${roleMeta[r].label}`); }}
            className={cn("flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-surface", r === role && "bg-surface")}>
            <div className="flex-1">
              <div className="text-sm font-medium">{roleMeta[r].label}</div>
              <div className="text-xs text-muted-foreground">{roleMeta[r].blurb}</div>
            </div>
            {r === role && <Check className="size-4 text-primary" />}
          </button>
        ))}
        <button onClick={() => { setOpen(false); reset(); navigate({ to: "/" }); toast.success("Đã khôi phục dữ liệu mẫu"); }} className="mt-1 flex w-full items-center gap-2 border-t px-3 py-2.5 text-xs text-muted-foreground hover:text-foreground">
          <RotateCcw className="size-3.5" /> Khôi phục dữ liệu mẫu
        </button>
      </PopoverContent>
    </Popover>
  );
}
