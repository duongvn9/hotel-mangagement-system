import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useStore } from "@/lib/store";
import { roleMeta } from "@/lib/nav";

export const Route = createFileRoute("/app/")({
  component: () => {
    const role = useStore((s) => s.role);
    return <Navigate to={role === "GUEST" ? "/login" : roleMeta[role].home} />;
  },
});
