/**
 * English texts: roleplay order mode (shops accept and deliver orders by hand in the game).
 * The plugin publishes the mode in plugin_settings.orders_mode; in automatic mode the texts of
 * m.status are used as before. The deadlines are plugin config: never show exact hours here.
 */
export const roleplay = {
  /** Name of each order mode (admin overview, help). */
  modes: {
    automatic: "Automatic",
    roleplay: "Roleplay",
  },

  /** Game commands of the roleplay mode (the plugin only has English command names). */
  commands: {
    computerBuy: "/cz computer buy [amount]",
    computerGive: "/cz computer give <player> [amount]",
    employeeAdd: "/cz employee add <shop> <player>",
    employeeRemove: "/cz employee remove <shop> <player>",
    employeeList: "/cz employee list <shop>",
    /** Same commands with the slug of one shop filled in (employees page). */
    employeeAddShop: "/cz employee add {slug} <player>",
    employeeRemoveShop: "/cz employee remove {slug} <player>",
    employeeListShop: "/cz employee list {slug}",
  },

  /** Order statuses that read differently in roleplay mode (the rest come from m.status). */
  status: {
    order: {
      PENDING: "Waiting for the shop",
      PAID: "Accepted, being prepared",
    },
    stamp: {
      PENDING: "To accept",
      PAID: "Preparing",
    },
    help: {
      PENDING:
        "The shop has to accept your order from its computer in the game. You are not charged until then, and if the shop does not handle it in time, it is canceled at no cost.",
      PAID:
        "The shop accepted the order and you have been charged. It is now being prepared, and someone from the shop will bring it to your locker; this can take a few hours. If it does not arrive in time, you get your money back.",
    },
    processingHelp: "The shop just accepted your order and the server is charging you right now.",
    /** Tracking steps of the order page. */
    steps: {
      PAID: "Accepted and charged",
      READY: "Delivered to the locker",
    },
    receiptPending: "Not charged: the shop has not accepted it yet",
  },

  /** New orders.failure_reason codes of the roleplay mode. */
  failureReason: {
    SHOP_REJECTED: "The shop canceled the order.",
    EXPIRED: "The shop did not handle the order in time, so it was canceled automatically.",
    DELIVERY_EXPIRED:
      "The shop accepted the order but did not deliver it to the locker in time. Your money has been refunded.",
    INVALID_TIP: "The tip was above the server maximum (or tips are turned off). You have not been charged.",
  },

  checkout: {
    noticeTitle: "Each shop handles its orders by hand",
    notice:
      "The shop has to accept your order from the game. You are charged when it accepts, not now. If the shop does not handle it in time, it is canceled at no cost.",
    payment:
      "Nothing is charged when you confirm: the server will take {total} from your in-game balance when the shop accepts the order. If you do not have enough, the order fails at no cost.",
    paymentExpress:
      "Nothing is charged when you confirm: the server will take {total} plus {fee} for express delivery from your in-game balance when the shop accepts the order. If you do not have enough, the order fails at no cost.",
  },

  orders: {
    created: {
      one: "Order confirmed. Now the shop has to accept it; you will be charged then.",
      other: "{count} orders confirmed. Each shop has to accept its own; you will be charged then.",
    },
  },

  /** Seller panel of one shop (/panel/<slug>). */
  panel: {
    nav: "Employees",
    filters: {
      PENDING: "To accept",
      PAID: "Preparing",
    },
    ordersHint:
      "Roleplay mode: you accept or reject orders from the shop's Company Computer, in the game. Accepting charges the buyer and the money is held; you get it when the package reaches the locker.",
    /** "Paid out" column of the orders table (orders.seller_paid_at). */
    payout: {
      column: "Paid out",
      pending: "Pending",
      pendingDelivery: "On delivery",
      none: "—",
    },
    computer: {
      title: "Company Computer",
      count: {
        zero: "No computers in the zone",
        one: "{count} computer in the zone",
        other: "{count} computers in the zone",
      },
      missingTitle: "Your shop has no Company Computer",
      missing:
        "Without a computer you cannot accept orders, so they expire without being charged. Buy one with {command} and place it inside your shop's zone.",
      missingNoZone:
        "Also, your shop has no zone yet: ask an admin to mark it in the game so you can place it.",
      buy: "Buy one with {command} and place it inside your shop's zone.",
      ok: "Use it to accept or reject orders and to print packages for the locker.",
      employees: {
        zero: "Only you can use it.",
        one: "You and {count} employee can use it.",
        other: "You and {count} employees can use it.",
      },
      manageEmployees: "Manage employees",
    },
  },

  /** Employees page of one shop (/panel/<slug>/staff). */
  employees: {
    metaTitle: "Your shop's employees",
    title: "Employees",
    intro:
      "Employees use the shop's Company Computer according to their rank: accepting or rejecting orders, printing packages, depositing stock… The owner can always do everything.",
    readOnly: "Your rank cannot manage staff: here you can only see who works at the shop.",
    noAssignableRoles: "Every rank in the shop includes \"Manage staff\", so only the owner can hire.",
    automaticNote:
      "Right now the server processes orders on its own (automatic mode), so employees have nothing to do for now. They will come in handy if the server switches to roleplay mode.",
    caption: "Shop employees",
    columns: {
      player: "Player",
      role: "Rank",
      since: "Since",
      addedBy: "Added by",
      actions: "Actions",
    },
    unknownPlayer: "Unknown player",
    count: { zero: "No employees", one: "{count} employee", other: "{count} employees" },
    empty: {
      title: "It's just you here",
      body: "Add whoever helps you with orders. They must have joined the server at least once.",
    },
    remove: "Remove",
    removing: "Removing…",
    owner: "Owner",
    you: "(you)",
    noRole: "No rank",
    changeRole: "Change",
    changingRole: "Changing…",
    roleLabel: "{name}'s rank",
    add: {
      title: "Add employee",
      label: "Minecraft name",
      hint: "Exactly as it appears in the game. They must have joined the server at least once.",
      placeholder: "Steve",
      role: "Rank",
      roleHint: "What they will be able to do in the shop. You can change it later.",
      submit: "Add",
      submitting: "Adding…",
      added: "{name} is now an employee of the shop.",
    },
    limitNote: {
      zero: "Right now the server does not allow working in other players' shops.",
      one: "Each player can work as an employee in at most {count} shop they do not own.",
      other: "Each player can work as an employee in at most {count} shops they do not own.",
    },
    game: "Also from the game:",
    suspended: "This shop is suspended: you cannot add employees.",
    errors: {
      format: "Enter the name exactly as it appears in the game: up to 16 letters, numbers or underscores, no spaces.",
      notFound:
        "There is no player named \"{name}\". They must join the server at least once before you can add them.",
      owner: "You are the shop owner: you can already use the computer without being an employee.",
      exists: "{name} is already an employee of the shop.",
      limit: "{name} already works at the maximum number of shops allowed ({max}). They have to leave one first.",
      role: "Choose one of the shop's ranks.",
      roleForbidden: "Only the owner can give a rank with \"Manage staff\".",
      suspended: "This shop is suspended: you cannot add employees.",
      generic: "Could not save. Try again in a moment.",
    },
  },

  admin: {
    modeTitle: "Order mode",
    modeHint: {
      automatic: "The plugin charges and prepares orders on its own.",
      roleplay: "Each shop accepts and delivers its orders from the game.",
    },
    modeChange: "It is changed in the plugin config (orders.mode) and requires a server restart.",
    stuckHint:
      "In roleplay mode, orders wait for each shop to accept them, so it is normal for some to stay pending for a while. They expire on their own if nobody handles them.",
  },
} as const;
