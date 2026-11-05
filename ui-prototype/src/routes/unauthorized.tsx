import { createFileRoute } from "@tanstack/react-router";
import { Unauthorized } from "@/components/hms/Unauthorized";

export const Route = createFileRoute("/unauthorized")({
  head: () => ({ meta: [
    { title: "Hạn chế truy cập — Emily Hotel" },
    { name: "description", content: "Bạn không có quyền xem trang này." },
    { property: "og:title", content: "Hạn chế truy cập — Emily Hotel" },
    { property: "og:description", content: "Cần có quyền truy cập." },
  ] }),
  component: () => <div className="grid min-h-screen place-items-center p-6"><Unauthorized /></div>,
});
