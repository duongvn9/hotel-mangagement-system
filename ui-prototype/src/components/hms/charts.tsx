import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { format } from "date-fns";
import type { Data } from "@/lib/mock";
import { day } from "@/lib/mock";

const axis = { stroke: "var(--muted-foreground)", fontSize: 12, tickLine: false, axisLine: false };
const tip = { contentStyle: { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 } };

export function revenueSeries(data: Data, days = 14) {
  return Array.from({ length: days }, (_, i) => {
    const d = day(i - days + 1);
    const amt = data.payments.filter((p) => p.status === "SUCCESS" && p.date === d).reduce((s, p) => s + p.amount, 0);
    return { d: format(new Date(d), "dd/MM"), revenue: Math.round((amt + 6000000 + ((i * 7919) % 9) * 900000) / 1000) * 1000 };
  });
}

export function RevenueArea({ series }: { series: { d: string; revenue: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={series}>
        <defs><linearGradient id="rv" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="var(--primary)" stopOpacity={0.3} /><stop offset="100%" stopColor="var(--primary)" stopOpacity={0} /></linearGradient></defs>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="d" {...axis} /><YAxis {...axis} tickFormatter={(v) => `${v / 1e6}tr`} width={40} />
        <Tooltip {...tip} formatter={(v: number) => new Intl.NumberFormat("vi-VN").format(v) + " ₫"} />
        <Area type="monotone" dataKey="revenue" stroke="var(--primary)" strokeWidth={2} fill="url(#rv)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function SimpleBars({ data, k, color = "var(--primary)" }: { data: any[]; k: string; color?: string }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data}><CartesianGrid vertical={false} stroke="var(--border)" /><XAxis dataKey="name" {...axis} /><YAxis {...axis} width={40} /><Tooltip {...tip} /><Bar dataKey={k} fill={color} radius={[8, 8, 0, 0]} /></BarChart>
    </ResponsiveContainer>
  );
}

const pal = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
export function Donut({ data }: { data: { name: string; value: number }[] }) {
  return (
    <div className="flex items-center gap-6">
      <ResponsiveContainer width={160} height={160}>
        <PieChart><Pie data={data} dataKey="value" innerRadius={50} outerRadius={75} paddingAngle={2}>{data.map((_, i) => <Cell key={i} fill={pal[i % pal.length]} />)}</Pie><Tooltip {...tip} /></PieChart>
      </ResponsiveContainer>
      <div className="grid gap-2 text-sm">{data.map((d, i) => <div key={d.name} className="flex items-center gap-2"><span className="size-2.5 rounded-full" style={{ background: pal[i % pal.length] }} />{d.name}<span className="ml-2 text-muted-foreground">{d.value}</span></div>)}</div>
    </div>
  );
}
