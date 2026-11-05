import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthLayout } from "@/components/hms/AuthLayout";
import { useStore } from "@/lib/store";
import { roleMeta } from "@/lib/nav";
import type { Role } from "@/lib/mock";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [
    { title: "Đăng nhập — Emily Hotel" },
    { name: "description", content: "Đăng nhập để quản lý đặt phòng hoặc vào khu làm việc của nhân viên." },
    { property: "og:title", content: "Đăng nhập — Emily Hotel" },
    { property: "og:description", content: "Đăng nhập cho khách và nhân viên." },
  ] }),
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const accounts = useStore((s) => s.data.accounts);
  const setRole = useStore((s) => s.setRole);
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const enter = (r: Role) => { setRole(r); toast.success(`Chào mừng trở lại, ${roleMeta[r].person}`); navigate({ to: roleMeta[r].home }); };

  return (
    <AuthLayout title="Chào mừng trở lại" subtitle="Đăng nhập vào tài khoản Emily Hotel của bạn.">
      <form className="grid gap-4" onSubmit={(e) => {
        e.preventDefault();
        if (!/^\S+@\S+\.\S+$/.test(email)) return setErr("Hãy nhập địa chỉ email hợp lệ");
        if (pw.length < 6) return setErr("Mật khẩu cần ít nhất 6 ký tự");
        const acc = accounts.find((a) => a.email === email);
        if (!acc) return setErr("Không có tài khoản nào khớp email này. Hãy thử tài khoản demo bên dưới.");
        if (!acc.active) return setErr("Tài khoản này đã bị quản lý vô hiệu hoá.");
        setErr(""); enter(acc.role);
      }}>
        <div className="grid gap-1.5"><Label htmlFor="email">Email</Label><Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="grid gap-1.5"><Label htmlFor="pw">Mật khẩu</Label><Input id="pw" type="password" value={pw} onChange={(e) => setPw(e.target.value)} /></div>
        {err && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{err}</p>}
        <Button type="submit" size="lg" className="rounded-full">Đăng nhập</Button>
      </form>
      <p className="mt-4 text-sm text-muted-foreground">Chưa có tài khoản? <Link to="/register" className="font-medium text-primary">Tạo tài khoản</Link></p>
      <div className="mt-10">
        <div className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Tài khoản demo (mật khẩu bất kỳ từ 6 ký tự)</div>
        <div className="grid gap-2 sm:grid-cols-2">
          {accounts.filter((a) => a.active).slice(0, 6).map((a) => (
            <button key={a.id} onClick={() => { setEmail(a.email); setPw("demo123"); }} className="rounded-xl border p-3 text-left text-sm hover:border-primary">
              <div className="font-medium">{roleMeta[a.role].label}</div><div className="truncate text-xs text-muted-foreground">{a.email}</div>
            </button>
          ))}
        </div>
      </div>
    </AuthLayout>
  );
}
