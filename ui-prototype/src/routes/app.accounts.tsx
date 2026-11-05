import { createFileRoute } from "@tanstack/react-router";
import { CrudPage, opts } from "@/components/hms/CrudPage";
import { StatusBadge } from "@/components/hms/ui";
import { roleMeta } from "@/lib/nav";
import type { Account } from "@/lib/mock";

const roles = ["CUSTOMER", "RECEPTIONIST", "SERVICE_STAFF", "OPERATIONS_STAFF", "MANAGER"];
export const Route = createFileRoute("/app/accounts")({
  head: () => ({ meta: [{ title: "Tài khoản — Emily Hotel" }, { name: "description", content: "Quản lý tài khoản nhân viên và khách hàng." }, { property: "og:title", content: "Tài khoản" }, { property: "og:description", content: "Tài khoản người dùng" }] }),
  component: () => (
    <CrudPage<Account> title="Tài khoản" subtitle="Tạo tài khoản nhân viên, phân vai trò và khoá quyền truy cập." collection="accounts" noun="tài khoản" idPrefix="u"
      defaults={{ name: "", email: "", role: "RECEPTIONIST", active: true }} search={(a) => `${a.name} ${a.email}`}
      filters={[{ key: "role", label: "Vai trò", options: roles }]}
      columns={[
        { key: "name", header: "Tên", render: (a) => <span className="font-medium">{a.name}</span> }, { key: "email", header: "Email" },
        { key: "role", header: "Vai trò", render: (a) => roleMeta[a.role].label }, { key: "active", header: "Trạng thái", render: (a) => <StatusBadge status={a.active ? "ACTIVE" : "INACTIVE"} /> },
      ]}
      fields={[{ name: "name", label: "Họ và tên", required: true }, { name: "email", label: "Email", required: true }, { name: "role", label: "Vai trò", type: "select", options: opts(roles) }, { name: "active", label: "Đang hoạt động", type: "switch" }]} />
  ),
});
