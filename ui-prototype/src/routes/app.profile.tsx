import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader, Panel } from "@/components/hms/ui";
import { useStore } from "@/lib/store";
import { roleMeta } from "@/lib/nav";

export const Route = createFileRoute("/app/profile")({
  head: () => ({ meta: [{ title: "Hồ sơ & cài đặt — Emily Hotel" }, { name: "description", content: "Quản lý hồ sơ và mật khẩu." }, { property: "og:title", content: "Hồ sơ" }, { property: "og:description", content: "Cài đặt tài khoản" }] }),
  component: Profile,
});

function Profile() {
  const role = useStore((s) => s.role);
  const g = useStore((s) => s.data.guests.find((x) => x.id === s.customerId));
  const acc = useStore((s) => s.data.accounts.find((a) => a.role === s.role));
  const base = role === "CUSTOMER" ? g : undefined;
  const [f, setF] = useState({ name: base?.name ?? acc?.name ?? roleMeta[role].person, email: base?.email ?? acc?.email ?? "", phone: base?.phone ?? "+84 905 111 222" });
  const [pw, setPw] = useState({ cur: "", next: "", again: "" });
  return (
    <div>
      <PageHeader title="Hồ sơ & cài đặt" subtitle={`Đang đăng nhập với vai trò ${roleMeta[role].label}`} />
      <Tabs defaultValue="profile">
        <TabsList className="rounded-full"><TabsTrigger className="rounded-full" value="profile">Hồ sơ</TabsTrigger><TabsTrigger className="rounded-full" value="security">Mật khẩu</TabsTrigger><TabsTrigger className="rounded-full" value="prefs">Thông báo</TabsTrigger></TabsList>
        <TabsContent value="profile" className="mt-6">
          <Panel title="Thông tin cá nhân">
            <form className="grid max-w-xl gap-4" onSubmit={(e) => { e.preventDefault(); if (!f.name.trim() || !/^\S+@\S+\.\S+$/.test(f.email)) return toast.error("Cần nhập tên và email hợp lệ"); if (role === "CUSTOMER" && g) useStore.getState().patch("guests", g.id, f); toast.success("Đã lưu hồ sơ"); }}>
              {(["name", "email", "phone"] as const).map((k) => <div key={k} className="grid gap-1.5"><Label className="capitalize" htmlFor={k}>{k}</Label><Input id={k} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></div>)}
              <Button className="w-fit rounded-full">Lưu thay đổi</Button>
            </form>
          </Panel>
        </TabsContent>
        <TabsContent value="security" className="mt-6">
          <Panel title="Đổi mật khẩu">
            <form className="grid max-w-xl gap-4" onSubmit={(e) => { e.preventDefault(); if (!pw.cur) return toast.error("Hãy nhập mật khẩu hiện tại"); if (pw.next.length < 8) return toast.error("Mật khẩu mới cần từ 8 ký tự"); if (pw.next !== pw.again) return toast.error("Mật khẩu không khớp"); setPw({ cur: "", next: "", again: "" }); toast.success("Đã cập nhật mật khẩu"); }}>
              {([["cur", "Mật khẩu hiện tại"], ["next", "Mật khẩu mới"], ["again", "Xác nhận mật khẩu mới"]] as const).map(([k, l]) => <div key={k} className="grid gap-1.5"><Label htmlFor={k}>{l}</Label><Input id={k} type="password" value={pw[k]} onChange={(e) => setPw({ ...pw, [k]: e.target.value })} /></div>)}
              <Button className="w-fit rounded-full">Cập nhật mật khẩu</Button>
            </form>
          </Panel>
        </TabsContent>
        <TabsContent value="prefs" className="mt-6">
          <Panel title="Thông báo qua email">
            {["Xác nhận đặt phòng", "Cập nhật yêu cầu dịch vụ", "Khuyến mãi và ưu đãi"].map((l, i) => <div key={l} className="flex items-center justify-between border-b py-3 last:border-0 text-sm">{l}<Switch defaultChecked={i < 2} onCheckedChange={() => toast("Đã lưu tuỳ chọn")} /></div>)}
          </Panel>
        </TabsContent>
      </Tabs>
    </div>
  );
}
