"use server";

import { refresh } from "next/cache";
import { fmt, m } from "@/i18n";
import { isUuid } from "@/lib/data/catalog";
import { requireSellerShop } from "@/lib/data/seller";
import { createShopRole, deleteShopRole, getMaxShopRoles, setDefaultShopRole, updateShopRole } from "@/lib/data/shop-roles";
import { parsePermissions, parseRoleName, type ShopPermission } from "@/lib/seller/permissions";
import { panelPath } from "@/lib/seller/shops";
import { canEditShop } from "@/lib/seller/stats";

/**
 * Ranks of the shop whose slug the page bound. Only its owner manages them: every action loads the
 * shop again by slug with ownerOnly (employees get a 404), and the database checks the rest
 * (names unique per shop, the default rank cannot be deleted, ranks per shop).
 */

/** `values`: what was sent, to keep it in the form after an error. */
export type RoleFormState = {
  status: "idle" | "saved" | "error";
  message: string | null;
  nameError?: string;
  values?: { name: string; permissions: ShopPermission[] };
};

const t = m.roles;

/** Creates a rank (no id in the form) or renames one and sets its permissions. */
export async function saveRoleAction(shopSlug: string, _state: RoleFormState, formData: FormData): Promise<RoleFormState> {
  const { shop } = await requireSellerShop(shopSlug, panelPath(shopSlug, "ranks"), { ownerOnly: true });
  const id = formData.get("id");
  const rawName = formData.get("name");
  const values = {
    name: typeof rawName === "string" ? rawName.slice(0, 60) : "",
    permissions: parsePermissions(formData.getAll("permissions")),
  };
  const failed = (message: string, nameError?: string): RoleFormState => ({ status: "error", message, nameError, values });

  if (!canEditShop(shop.status)) return failed(t.errors.suspended);
  const parsed = parseRoleName(values.name);
  if ("error" in parsed) {
    const message = parsed.error === "required" ? t.errors.nameRequired : t.errors.nameLength;
    return failed(message, message);
  }
  const input = { name: parsed.name, permissions: values.permissions };

  try {
    if (isUuid(id)) {
      const result = await updateShopRole(shop.id, id, input);
      if (result === "exists") return failed(t.errors.exists, t.errors.exists);
      if (result === "notFound") return failed(t.errors.notFound);
    } else {
      const result = await createShopRole(shop.id, input);
      if (result === "exists") return failed(t.errors.exists, t.errors.exists);
      if (result === "limit") return failed(fmt(t.errors.limit, { max: await getMaxShopRoles() }));
    }
  } catch (error) {
    console.error("saveRoleAction", error);
    return failed(t.errors.generic);
  }

  refresh();
  return { status: "saved", message: isUuid(id) ? t.form.saved : fmt(t.form.created, { name: input.name }) };
}

/** Deletes a rank; its employees move to the default rank (the database does it). */
export async function deleteRoleAction(shopSlug: string, formData: FormData): Promise<void> {
  const { shop } = await requireSellerShop(shopSlug, panelPath(shopSlug, "ranks"), { ownerOnly: true });
  const id = formData.get("id");
  if (!isUuid(id) || !canEditShop(shop.status)) return;
  await deleteShopRole(shop.id, id);
  refresh();
}

/** Makes a rank the one new employees get. */
export async function setDefaultRoleAction(shopSlug: string, formData: FormData): Promise<void> {
  const { shop } = await requireSellerShop(shopSlug, panelPath(shopSlug, "ranks"), { ownerOnly: true });
  const id = formData.get("id");
  if (!isUuid(id) || !canEditShop(shop.status)) return;
  await setDefaultShopRole(shop.id, id);
  refresh();
}
