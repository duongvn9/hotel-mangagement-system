import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { AuthLayout } from "@/components/hms/AuthLayout";
import { useStore, newId } from "@/lib/store";

export const Route = createFileRoute("/register")({
  head: () => ({ meta: [
    { title: "Tạo tài khoản — Emily Hotel" },
    { name: "description", content: "Tạo tài khoản khách để quản lý đặt phòng, dịch vụ và đánh giá." },
    { property: "og:title", content: "Tạo tài khoản — Emily Hotel" },
    { property: "og:description", content: "Tham gia Emily Hotel." },
  ] }),
  component: Register,
});

function Register() {
  const navigate = useNavigate();
  const [f, setF] = useState({ name: "", email: "", phone: "", pw: "", pw2: "" });
  const [agree, setAgree] = useState(false);
  const [e, setE] = useState<Record<string, string>>({});
  const submit = (ev: React.FormEvent) => {
    ev.preventDefault();
    const x: Record<string, string> = {};
    if (f.name.trim().length < 2) x.name = "Hãy nhập họ tên";
    if (!/^\S+@\S+\.\S+$/.test(f.email)) x.email = "Email không hợp lệ";
    if (useStore.getState().data.accounts.some((a) => a.email === f.email)) x.email = "Email này đã được đăng ký";
    if (!/^[+\d\s]{9,15}$/.test(f.phone)) x.phone = "Số điện thoại không hợp lệ";
    if (f.pw.length < 8) x.pw = "Tối thiểu 8 ký tự";
    if (f.pw !== f.pw2) x.pw2 = "Mật khẩu không khớp";
    if (!agree) x.agree = "Vui lòng đồng ý với điều khoản";
    setE(x);
    if (Object.keys(x).length) return;
    const s = useStore.getState();
    const gid = newId("g");
    s.upsert("guests", { id: gid, name: f.name, email: f.email, phone: f.phone, idNumber: "", nationality: "Vietnam" });
    s.upsert("accounts", { id: newId("u"), name: f.name, email: f.email, role: "CUSTOMER", active: true });
    useStore.setState({ customerId: gid, role: "CUSTOMER" });
    toast.success("Đã tạo tài khoản — chào mừng bạn!");
    navigate({ to: "/app/home" });
  };
  const field = (k: keyof typeof f, l: string, type = "text") => (
    <div className="grid gap-1.5"><Label htmlFor={k}>{l}</Label><Input id={k} type={type} value={f[k]} onChange={(ev) => setF({ ...f, [k]: ev.target.value })} aria-invalid={!!e[k]} />{e[k] && <p className="text-xs text-destructive">{e[k]}</p>}</div>
  );
  return (
    <AuthLayout title="Tạo tài khoản của bạn" subtitle="Quản lý đặt phòng, đặt dịch vụ phòng và gửi đánh giá.">
      <form className="grid gap-4" onSubmit={submit}>
        {field("name", "Họ và tên")}{field("email", "Email", "email")}{field("phone", "Điện thoại")}
        <div className="grid gap-4 sm:grid-cols-2">{field("pw", "Mật khẩu", "password")}{field("pw2", "Xác nhận mật khẩu", "password")}</div>
        <label className="flex items-center gap-2 text-sm"><Checkbox checked={agree} onCheckedChange={(v) => setAgree(!!v)} /> Tôi đồng ý với điều khoản và chính sách bảo mật</label>
        {e.agree && <p className="text-xs text-destructive">{e.agree}</p>}
        <Button type="submit" size="lg" className="rounded-full">Tạo tài khoản</Button>
      </form>
      <p className="mt-4 text-sm text-muted-foreground">Đã có tài khoản? <Link to="/login" className="font-medium text-primary">Đăng nhập</Link></p>
    </AuthLayout>
  );
}
