/**
 * English texts of the web. Same keys as ../es/common.ts. Tone: "you", short sentences, dry humour in secondary labels and
 * empty states, never in errors or anything about money. No emojis.
 */
export const common = {
  meta: {
    siteName: "Cubezon",
    tagline: "From the mine to your locker",
    description:
      "The server's marketplace: approved shops sell in-game items for in-game money and you pick them up at a locker.",
    titleTemplate: "%s · Cubezon",
  },

  a11y: {
    skipToContent: "Skip to content",
    categoriesNav: "Categories",
    siteNav: "Cubezon sections",
    breadcrumbs: "Breadcrumbs",
    pagination: "Pagination",
    close: "Close",
    openMenu: "Open menu",
    itemIcon: "{name} icon",
    avatar: "{name}'s avatar",
    shopSeal: "{name} seal",
    rating: "{rating} out of 5",
    barcode: "Barcode for order {code}",
    loading: "Loading…",
  },

  money: {
    suffix: " $",
    perItem: "{price} / unit",
    free: "Free",
  },

  common: {
    save: "Save",
    saving: "Saving…",
    cancel: "Cancel",
    edit: "Edit",
    delete: "Delete",
    back: "Back",
    seeAll: "See all",
    seeMore: "See more",
    yes: "Yes",
    no: "No",
    optional: "optional",
    required: "required",
    send: "Send",
    search: "Search",
    apply: "Apply",
    clear: "Clear filters",
    copy: "Copy",
    copied: "Copied",
    retry: "Try again",
    none: "—",
    serial: "No. {serial}",
    newTag: "New",
    officialStamp: "Official",
    soldOutStamp: "Sold out",
    actions: "Actions",
    status: "Status",
    date: "Date",
    total: "Total",
  },

  header: {
    topbar: [
      "Pick up at lockers all over the server",
      "In-game money only",
      "New here? Link your account with {command}",
    ],
    home: "Cubezon, home",
    search: {
      label: "Search Cubezon",
      placeholder: "Search diamonds, pickaxes, cakes…",
      scope: "Section",
      allCategories: "All",
      submit: "Search",
    },
    account: {
      signIn: "Sign in",
      signInHint: "Link your account",
      hello: "Hi, {name}",
      myAccount: "My account",
      menuLabel: "Account shortcuts",
      menu: {
        account: "My account",
        shops: "My shops",
        sell: "Open a shop",
        admin: "Admin",
        help: "Help",
        signOut: "Sign out",
      },
    },
    categories: "Categories",
    categoriesLabel: "All categories",
    orders: "Orders",
    ordersHint: "Tracking",
    cart: "Cart",
    cartCount: { zero: "Cart is empty", one: "{count} unit in your cart", other: "{count} units in your cart" },
  },

  nav: {
    all: "Full catalog",
    shops: "Shops",
    lockers: "Lockers",
    sell: "Sell on Cubezon",
    help: "Help",
    panel: "My shop",
    admin: "Admin",
  },

  categories: {
    blocks: { name: "Blocks", blurb: "Build whatever you like" },
    tools: { name: "Tools", blurb: "Pickaxes, axes and friends" },
    combat: { name: "Combat", blurb: "Swords, bows and shields" },
    armor: { name: "Armor", blurb: "From leather to netherite" },
    food: { name: "Food", blurb: "So you don't starve" },
    magic: { name: "Potions and magic", blurb: "Books, potions and totems" },
    redstone: { name: "Redstone", blurb: "Circuits and contraptions" },
    decoration: { name: "Decoration", blurb: "Make the place feel like home" },
    materials: { name: "Materials", blurb: "Ingots, gems and dusts" },
    misc: { name: "Other", blurb: "Whatever fits no other drawer" },
  },

  worlds: {
    world: "Overworld",
    world_nether: "Nether",
    world_the_end: "The End",
  },

  /** Role of the player in a shop's panel. */
  panelRole: {
    owner: "Owner",
    /** An employee whose rank has no name (should not happen: every member gets one). */
    employee: "Employee",
  },

  language: {
    label: "Language",
    en: "English",
    es: "Español",
  },

  theme: {
    label: "Theme",
    system: "System",
    light: "Light",
    dark: "Dark",
  },

  footer: {
    backToTop: "Back to top",
    columns: {
      buy: "Buy",
      sell: "Sell",
      help: "Help",
      account: "Your account",
    },
    links: {
      catalog: "Full catalog",
      shops: "Server shops",
      lockers: "Pickup lockers",
      sell: "Open your shop",
      panel: "Seller panel",
      deposit: "How to deposit stock",
      howItWorks: "How it works",
      link: "Link your account",
      pickup: "Pick up an order",
      account: "My account",
      orders: "My orders",
      cart: "Cart",
      styleGuide: "Style sheet",
    },
    legal:
      "Cubezon is a portfolio project. It is not affiliated with Amazon or Mojang. Only in-game money is used: nobody pays real money here.",
    madeWith: "Printed in two inks on a Minecraft server.",
  },

  status: {
    order: {
      PENDING: "Awaiting payment",
      PAID: "Paid",
      READY: "Ready for pickup",
      COLLECTED: "Collected",
      FAILED: "Failed",
      REFUNDED: "Refunded",
    },
    processing: "Processing payment",
    processingStamp: "Processing",
    processingHelp: "The server is charging the order and reserving the items right now.",
    failureReason: {
      OUT_OF_STOCK: "The shop ran out of stock before your order was processed.",
      LISTING_UNAVAILABLE: "The product or the shop is no longer available.",
      LOCKER_UNAVAILABLE: "The locker you chose has been deactivated.",
      INVALID_ITEM: "The shop's items were damaged and could not be delivered.",
      INSUFFICIENT_FUNDS: "You did not have enough in-game balance.",
      PAYMENT_ERROR: "There was an error charging you in the game.",
      INTERRUPTED: "The server stopped while processing the order. An admin will review the charge.",
      PAYOUT_FAILED: "The shop could not be paid, so your money has been refunded.",
      REFUND_FAILED: "A serious error occurred while refunding your money. An admin will review it.",
      MAILBOX_UNAVAILABLE: "Your mailbox no longer exists, so the order could not be delivered.",
    },
    failureReasonUnknown: "Reason: {code}",
    /** Express orders (delivery_method MAILBOX): they reach the buyer's mailbox, not a locker. */
    mailbox: {
      order: { READY: "In your mailbox" },
      stamp: { READY: "In your mailbox" },
      help: {
        PAID: "Charged. It will reach your mailbox shortly, no locker involved.",
        READY:
          "Your order is waiting in your mailbox. Right-click it to collect, with as many free inventory slots as the order has units.",
      },
      steps: { READY: "In your mailbox" },
    },
    /** FAILED orders the shop rejected or nobody accepted in time (not an error: nothing was charged). */
    cancelled: {
      order: "Cancelled",
      stamp: "Cancelled",
      help: "You have not been charged anything.",
    },
    orderStamp: {
      PENDING: "Pending",
      PAID: "Paid",
      READY: "At locker",
      COLLECTED: "Collected",
      FAILED: "Failed",
      REFUNDED: "Refunded",
    },
    orderHelp: {
      PENDING: "The server will charge the order to your in-game balance as soon as it processes it.",
      PAID: "Charged. The shop is preparing your order to drop it at the locker.",
      READY: "Your order is waiting at the locker. Right-click it or use {command} within 5 blocks, with as many free inventory slots as the order has units.",
      COLLECTED: "Collected. Enjoy.",
      FAILED: "The order could not be completed and you have not been charged anything.",
      REFUNDED: "The amount has been returned to your in-game balance.",
    },
    shop: {
      PENDING: "Under review",
      APPROVED: "Approved",
      REJECTED: "Rejected",
      SUSPENDED: "Suspended",
    },
    listing: {
      ACTIVE: "Active",
      PAUSED: "Paused",
      REMOVED: "Removed",
    },
    staff: {
      ADMIN: "Admin",
      SUPERADMIN: "Superadmin",
    },
  },

  commands: {
    link: "/cz link",
    deposit: "/cz deposit",
    pickup: "/cz pickup",
    lockerCreate: "/cz locker create <name>",
    shopZone: "/cz shop {slug}",
    storage: "/cz storage",
    storageBuy: "/cz storage buy",
    mailbox: "/cz mailbox",
    mailboxBuy: "/cz mailbox buy",
  },

  product: {
    soldBy: "Sold by",
    officialShop: "Official shop",
    unit: { one: "{count} item per unit", other: "{count} items per unit" },
    unitShort: "×{count}",
    stock: {
      zero: "Sold out",
      one: "{count} unit left",
      other: "{count} units left",
    },
    lowStock: "Last few units",
    sold: { one: "{count} sold", other: "{count} sold" },
    ratingCount: { zero: "No reviews", one: "{count} review", other: "{count} reviews" },
    noRatings: "No reviews",
    pricePerItem: "Works out to {price} per item",
    listingNumber: "Product",
  },

  empty: {
    catalog: {
      title: "The storage is empty",
      body: "Shops have not deposited anything yet. Check back in a while or, better yet, open your own.",
      cta: "I want to sell",
    },
  },

  errors: {
    generic: {
      title: "Something broke in the storage",
      body: "It's not your fault. Try again and, if it keeps failing, tell a server admin.",
    },
    notFound: {
      title: "This block does not exist",
      body: "The page you are looking for fell into lava or was never here.",
      home: "Go to the home page",
    },
  },
} as const;
