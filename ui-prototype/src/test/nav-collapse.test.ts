import { describe, expect, it } from "vitest";
import { activeGroupTitle } from "@/lib/nav";

describe("sidebar section collapse", () => {
  it("expands only the section holding the page you are on", () => {
    expect(activeGroupTitle("MANAGER", "/app/dashboard")).toBe("Tổng quan");
    expect(activeGroupTitle("MANAGER", "/app/revenue")).toBe("Báo cáo");
    expect(activeGroupTitle("MANAGER", "/app/rooms")).toBe("Khách sạn");
  });
  it("keeps nested booking pages inside the section that lists them", () => {
    expect(activeGroupTitle("RECEPTIONIST", "/app/bookings/BK2401")).toBe("Lễ tân");
  });
  it("falls back to nothing when the path belongs to no section", () => {
    expect(activeGroupTitle("CUSTOMER", "/app/reconciliation")).toBeUndefined();
  });
});
