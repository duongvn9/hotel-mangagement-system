import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { PageHeader } from "@/components/hms/ui";
import { useStore } from "@/lib/store";
import { permissions } from "@/lib/mock";
import { roleMeta } from "@/lib/nav";

const roles = ["RECEPTIONIST", "SERVICE_STAFF", "OPERATIONS_STAFF", "MANAGER"] as const;
export const Route = createFileRoute("/app/roles")({
  head: () => ({ meta: [{ title: "Vai trò & quyền — Emily Hotel" }, { name: "description", content: "Ma trận quyền cho các vai trò nhân viên." }, { property: "og:title", content: "Vai trò & quyền" }, { property: "og:description", content: "Vai trò" }] }),
  component: Roles,
});

function Roles() {
  const rp = useStore((s) => s.data.rolePermissions);
  const accounts = useStore((s) => s.data.accounts);
  const toggle = (r: string, p: string, v: boolean) => {
    if (r === "MANAGER") return toast.error("Quyền của quản lý là cố định");
    useStore.getState().setPermissions(r, v ? [...rp[r], p] : rp[r].filter((x) => x !== p));
    toast.success(`${roleMeta[r as keyof typeof roleMeta].label}: ${v ? "đã cấp" : "đã thu hồi"} quyền ${p}`);
  };
  return (
    <div>
      <PageHeader title="Vai trò & quyền" subtitle="Kiểm soát những gì mỗi vai trò được phép làm." />
      <div className="card-soft overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b bg-surface/40 text-left text-xs uppercase tracking-wider text-muted-foreground"><th className="px-4 py-3 font-medium">Quyền</th>{roles.map((r) => <th key={r} className="px-4 py-3 text-center font-medium">{roleMeta[r].label}<div className="font-normal normal-case">{accounts.filter((a) => a.role === r).length} người dùng</div></th>)}</tr></thead>
          <tbody>{permissions.map((p) => <tr key={p} className="border-b last:border-0"><td className="px-4 py-3.5">{p}</td>{roles.map((r) => <td key={r} className="px-4 text-center"><Checkbox checked={rp[r]?.includes(p)} disabled={r === "MANAGER"} onCheckedChange={(v) => toggle(r, p, !!v)} aria-label={`${r} ${p}`} /></td>)}</tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}
