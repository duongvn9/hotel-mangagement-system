import { describe, expect, it } from "vitest";
import { canAccess } from "@/lib/nav";

describe("role access", () => {
  it("receptionist can open front desk but not room management", () => {
    expect(canAccess("RECEPTIONIST", "/app/front-desk")).toBe(true);
    expect(canAccess("RECEPTIONIST", "/app/rooms")).toBe(false);
  });
  it("customer can open own booking detail but not reconciliation", () => {
    expect(canAccess("CUSTOMER", "/app/bookings/BK2401")).toBe(true);
    expect(canAccess("CUSTOMER", "/app/reconciliation")).toBe(false);
  });
  it("guests cannot open any workspace page", () => {
    expect(canAccess("GUEST", "/app/home")).toBe(false);
  });
});
