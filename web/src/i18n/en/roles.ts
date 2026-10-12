/**
 * English texts: ranks of a shop (shop_roles) and their permissions. The permission names are the
 * same ones the game shows: keep them in sync with the plugin.
 */
export const roles = {
  nav: "Ranks",
  metaTitle: "Your shop's ranks",
  title: "Ranks",
  intro:
    "Each employee has a rank, and the rank decides what they can do on the shop's computer and in this panel. As the owner, you can do everything and you are the only one who creates, changes and deletes ranks.",
  staffNote:
    "Anyone with \"Manage staff\" can hire, fire and change ranks, but cannot give that permission or touch anyone who already has it.",
  limitNote: { one: "You can have at most {count} rank.", other: "You can have up to {count} ranks." },
  suspended: "This shop is suspended: you cannot change its ranks.",

  /** Same names as in the game. */
  permissions: {
    "orders.decide": "Accept and reject orders",
    "orders.package": "Print packages",
    "stock.deposit": "Deposit stock",
    "stock.withdraw": "Withdraw stock",
    "products.manage": "Manage products",
    "staff.manage": "Manage staff",
    "storage.buy": "Buy storage",
  },
  permissionHints: {
    "orders.decide": "Decides orders on the computer. Accepting charges the buyer.",
    "orders.package": "Prints the package of an accepted order to take it to the locker.",
    "stock.deposit": "Puts items into the shop's products.",
    "stock.withdraw": "Takes out unsold stock and keeps it in their inventory.",
    "products.manage": "Creates, edits, pauses and removes products, and sets their samples.",
    "staff.manage": "Hires, fires and changes the rank of employees.",
    "storage.buy": "Buys storage and computers for the shop.",
  },
  permissionsLegend: "Permissions",
  noPermissions: "No permissions",
  allPermissions: "All permissions",
  caption: "Shop ranks",
  columns: { name: "Rank", permissions: "Permissions", members: "Employees", actions: "Actions" },
  edit: "Edit",
  editTitle: "Edit \"{name}\"",
  default: "Default",
  defaultHint: "This is the rank new employees get. To delete it, pick another default first.",
  members: { zero: "Nobody has it", one: "{count} employee", other: "{count} employees" },

  form: {
    name: "Name",
    namePlaceholder: "Courier",
    save: "Save",
    saving: "Saving…",
    saved: "Rank saved.",
    create: "Create rank",
    creating: "Creating…",
    created: "Rank \"{name}\" created.",
  },
  newTitle: "New rank",
  limitReached: "You already have the maximum number of ranks. Delete one to create another.",
  makeDefault: "Make default",
  makingDefault: "Changing…",
  remove: "Delete",
  confirmRemove: "Delete the rank \"{name}\"? Its employees move to \"{fallback}\".",

  errors: {
    nameRequired: "Give it a name.",
    nameLength: "The name can be up to 24 characters.",
    exists: "There is already a rank with that name.",
    limit: "You already have the maximum number of ranks ({max}).",
    notFound: "That rank no longer exists. Reload the page.",
    suspended: "This shop is suspended: you cannot change its ranks.",
    generic: "Could not save. Try again in a moment.",
  },
} as const;
