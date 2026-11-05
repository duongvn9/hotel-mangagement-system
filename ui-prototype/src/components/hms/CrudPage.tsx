import { useState, type ReactNode } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useStore, newId } from "@/lib/store";
import { label } from "@/lib/format";
import { DataTable, type Column, type Filter } from "./DataTable";
import { PageHeader } from "./ui";

export interface FieldDef { name: string; label: string; type?: "text" | "number" | "select" | "textarea" | "switch" | "date"; options?: { value: string; label: string }[]; required?: boolean; min?: number }

export function CrudPage<T extends { id: string }>({
  title, subtitle, collection, columns, fields, defaults, idPrefix, search, filters, noun, extraActions,
}: {
  title: string; subtitle?: string; collection: string; columns: Column<T>[]; fields: FieldDef[]; defaults: Omit<T, "id">;
  idPrefix: string; search?: (r: T) => string; filters?: Filter<T>[]; noun: string; extraActions?: ReactNode;
}) {
  const rows = useStore((s) => (s.data as any)[collection]) as T[];
  const upsert = useStore((s) => s.upsert) as any;
  const remove = useStore((s) => s.remove) as any;
  const [editing, setEditing] = useState<any | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [del, setDel] = useState<T | null>(null);

  const save = () => {
    const errs: Record<string, string> = {};
    fields.forEach((f) => {
      const v = editing[f.name];
      if (f.required && (v === undefined || v === "" || v === null)) errs[f.name] = `Vui lòng nhập ${f.label.toLowerCase()}`;
      if (f.type === "number" && v !== "" && (isNaN(Number(v)) || (f.min !== undefined && Number(v) < f.min))) errs[f.name] = `${f.label} không hợp lệ`;
    });
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const item = { ...editing };
    fields.forEach((f) => { if (f.type === "number") item[f.name] = Number(item[f.name]); });
    const isNew = !item.id;
    if (isNew) item.id = newId(idPrefix);
    upsert(collection, item);
    toast.success(`Đã ${isNew ? "tạo" : "cập nhật"} ${noun}`);
    setEditing(null);
  };

  const cols: Column<T>[] = [
    ...columns,
    { key: "_actions", header: "", className: "w-24 text-right", render: (r) => (
      <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
        <Button size="icon" variant="ghost" className="size-8" aria-label="Sửa" onClick={() => { setErrors({}); setEditing({ ...r }); }}><Pencil className="size-4" /></Button>
        <Button size="icon" variant="ghost" className="size-8 text-destructive" aria-label="Xoá" onClick={() => setDel(r)}><Trash2 className="size-4" /></Button>
      </div>
    ) },
  ];

  return (
    <div>
      <PageHeader title={title} subtitle={subtitle} actions={<>{extraActions}<Button className="rounded-full" onClick={() => { setErrors({}); setEditing({ ...defaults }); }}><Plus className="size-4" /> Thêm {noun.toLowerCase()}</Button></>} />
      <DataTable rows={rows} columns={cols} search={search} filters={filters} onRowClick={(r) => { setErrors({}); setEditing({ ...r }); }} />

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing?.id ? `Sửa ${noun.toLowerCase()}` : `Thêm ${noun.toLowerCase()}`}</DialogTitle>
            <DialogDescription>Thay đổi chỉ được lưu trong bản mẫu này.</DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="grid gap-4 py-2">
              {fields.map((f) => (
                <div key={f.name} className="grid gap-1.5">
                  <Label htmlFor={f.name}>{f.label}{f.required && <span className="text-destructive"> *</span>}</Label>
                  {f.type === "textarea" ? (
                    <Textarea id={f.name} value={editing[f.name] ?? ""} onChange={(e) => setEditing({ ...editing, [f.name]: e.target.value })} />
                  ) : f.type === "switch" ? (
                    <Switch id={f.name} checked={!!editing[f.name]} onCheckedChange={(v) => setEditing({ ...editing, [f.name]: v })} />
                  ) : f.type === "select" ? (
                    <Select value={editing[f.name] ?? ""} onValueChange={(v) => setEditing({ ...editing, [f.name]: v })}>
                      <SelectTrigger id={f.name}><SelectValue placeholder="Chọn…" /></SelectTrigger>
                      <SelectContent>{f.options!.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                    </Select>
                  ) : (
                    <Input id={f.name} type={f.type ?? "text"} value={editing[f.name] ?? ""} onChange={(e) => setEditing({ ...editing, [f.name]: e.target.value })} aria-invalid={!!errors[f.name]} />
                  )}
                  {errors[f.name] && <p className="text-xs text-destructive">{errors[f.name]}</p>}
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Huỷ</Button>
            <Button onClick={save}>Lưu</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!del} onOpenChange={(o) => !o && setDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá {noun.toLowerCase()} này?</AlertDialogTitle>
            <AlertDialogDescription>Mục này sẽ bị xoá khỏi bản mẫu. Bạn có thể khôi phục bằng “Khôi phục dữ liệu mẫu”.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Giữ lại</AlertDialogCancel>
            <AlertDialogAction onClick={() => { remove(collection, del!.id); toast.success(`Đã xoá ${noun}`); setDel(null); }}>Xoá</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export const opts = (xs: string[]) => xs.map((x) => ({ value: x, label: label(x) }));
