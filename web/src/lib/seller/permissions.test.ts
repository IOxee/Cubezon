import { describe, expect, it } from "vitest";
import {
  can,
  canAssignRole,
  canManageMember,
  parsePermissions,
  parseRoleName,
  SHOP_PERMISSIONS,
  type StaffActor,
} from "./permissions";

const owner: StaffActor = { isOwner: true, permissions: [] };
const manager: StaffActor = { isOwner: false, permissions: ["staff.manage", "products.manage"] };
const courier: StaffActor = { isOwner: false, permissions: ["orders.package"] };

describe("parsePermissions", () => {
  it("keeps known permissions once, in the canonical order", () => {
    expect(parsePermissions(["staff.manage", "orders.decide", "staff.manage", "fly", 3, null])).toEqual([
      "orders.decide",
      "staff.manage",
    ]);
    expect(parsePermissions(null)).toEqual([]);
    expect(parsePermissions([...SHOP_PERMISSIONS].reverse())).toEqual([...SHOP_PERMISSIONS]);
  });
});

describe("can", () => {
  it("gives every permission to the owner and the rank's to an employee", () => {
    expect(can(owner, "storage.buy")).toBe(true);
    expect(can(manager, "products.manage")).toBe(true);
    expect(can(courier, "products.manage")).toBe(false);
  });
});

describe("ranks and members (no self-promotions)", () => {
  it("lets the owner assign any rank and manage anybody", () => {
    expect(canAssignRole(owner, ["staff.manage"])).toBe(true);
    expect(canManageMember(owner, ["staff.manage"])).toBe(true);
  });

  it("lets staff.manage assign and manage only ranks without staff.manage", () => {
    expect(canAssignRole(manager, ["orders.package"])).toBe(true);
    expect(canAssignRole(manager, ["orders.package", "staff.manage"])).toBe(false);
    expect(canManageMember(manager, [])).toBe(true);
    expect(canManageMember(manager, ["staff.manage"])).toBe(false);
  });

  it("lets nobody else assign or manage", () => {
    expect(canAssignRole(courier, [])).toBe(false);
    expect(canManageMember(courier, [])).toBe(false);
  });
});

describe("parseRoleName", () => {
  it("trims, collapses spaces and checks the length", () => {
    expect(parseRoleName("  Jefe   de  turno ")).toEqual({ name: "Jefe de turno" });
    expect(parseRoleName("   ")).toEqual({ error: "required" });
    expect(parseRoleName(null)).toEqual({ error: "required" });
    expect(parseRoleName("x".repeat(25))).toEqual({ error: "length" });
    expect(parseRoleName("x".repeat(24))).toEqual({ name: "x".repeat(24) });
  });
});
