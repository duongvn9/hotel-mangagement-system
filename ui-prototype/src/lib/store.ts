import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { seed, type Data, type Role, type Booking, type BookingStatus } from "./mock";

type Collection = Exclude<keyof Data, "rolePermissions">;

interface State {
  role: Role;
  customerId: string; // the guest record representing the signed-in customer
  data: Data;
  setRole: (r: Role) => void;
  upsert: <K extends Collection>(k: K, item: Data[K][number]) => void;
  remove: (k: Collection, id: string) => void;
  patch: <K extends Collection>(k: K, id: string, p: Partial<Data[K][number]>) => void;
  setBookingStatus: (id: string, s: BookingStatus) => void;
  createBooking: (b: Booking) => void;
  setPermissions: (role: string, perms: string[]) => void;
  reset: () => void;
}

const clone = () => JSON.parse(JSON.stringify(seed)) as Data;

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      role: "GUEST",
      customerId: "g1",
      data: clone(),
      setRole: (role) => set({ role }),
      upsert: (k, item: any) =>
        set((s) => {
          const list = s.data[k] as any[];
          const exists = list.some((x) => x.id === item.id);
          return { data: { ...s.data, [k]: exists ? list.map((x) => (x.id === item.id ? item : x)) : [item, ...list] } };
        }),
      remove: (k, id) => set((s) => ({ data: { ...s.data, [k]: (s.data[k] as any[]).filter((x) => x.id !== id) } })),
      patch: (k, id, p) => set((s) => ({ data: { ...s.data, [k]: (s.data[k] as any[]).map((x) => (x.id === id ? { ...x, ...p } : x)) } })),
      setBookingStatus: (id, status) => {
        const { data, patch, upsert } = get();
        const b = data.bookings.find((x) => x.id === id);
        if (!b) return;
        patch("bookings", id, { status, ...(status === "CHECKED_OUT" ? { paid: b.total } : {}), ...(status === "CONFIRMED" && b.paid < b.deposit ? { paid: b.deposit } : {}) });
        if (status === "CHECKED_IN") patch("rooms", b.roomId, { status: "OCCUPIED" });
        if (status === "CHECKED_OUT") {
          patch("rooms", b.roomId, { status: "CLEANING" });
          const room = data.rooms.find((r) => r.id === b.roomId);
          upsert("tasks", { id: `T${Date.now() % 100000}`, title: `Dọn phòng ${room?.number} sau trả phòng`, type: "CLEANING", roomId: b.roomId, role: "SERVICE_STAFF", assignee: "Mai Phương", status: "OPEN", priority: "HIGH", due: new Date().toISOString().slice(0, 10) });
          if (b.total > b.paid) upsert("payments", { id: `PM${Date.now() % 100000}`, bookingId: id, amount: b.total - b.paid, method: "CARD", status: "SUCCESS", reconciled: false, date: new Date().toISOString().slice(0, 10) });
        }
      },
      createBooking: (b) => get().upsert("bookings", b),
      setPermissions: (role, perms) => set((s) => ({ data: { ...s.data, rolePermissions: { ...s.data.rolePermissions, [role]: perms } } })),
      reset: () => set({ data: clone(), role: "GUEST" }),
    }),
    { name: "propel-hms-prototype-vi", storage: createJSONStorage(() => localStorage), skipHydration: true },
  ),
);

export const newId = (prefix: string) => `${prefix}${Math.floor(1000 + Math.random() * 9000)}`;

/** Lookup helpers bound to current data */
export function useLookup() {
  const data = useStore((s) => s.data);
  const room = (id: string) => data.rooms.find((r) => r.id === id);
  const type = (id: string) => data.roomTypes.find((t) => t.id === id);
  const guest = (id: string) => data.guests.find((g) => g.id === id);
  const roomType = (roomId: string) => type(room(roomId)?.typeId ?? "");
  const booking = (id: string) => data.bookings.find((b) => b.id === id);
  const service = (id: string) => data.services.find((s) => s.id === id);
  return { data, room, type, guest, roomType, booking, service };
}

/** Rooms of a type free for the given range (no CONFIRMED/CHECKED_IN overlap and not in maintenance). */
export function freeRooms(data: Data, typeId: string, from: string, to: string) {
  return data.rooms.filter((r) => r.typeId === typeId && r.status !== "MAINTENANCE" && !data.bookings.some((b) => b.roomId === r.id && ["CONFIRMED", "CHECKED_IN", "ROOM_HELD", "PENDING_DEPOSIT"].includes(b.status) && b.checkIn < to && b.checkOut > from));
}

import { useEffect, useState } from "react";
/** True once persisted demo state has been restored in the browser. */
export function useHydrated() {
  const [h, setH] = useState(false);
  useEffect(() => {
    if (useStore.persist.hasHydrated()) setH(true);
    return useStore.persist.onFinishHydration(() => setH(true));
  }, []);
  return h;
}
