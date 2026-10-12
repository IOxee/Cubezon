/**
 * English texts: seller area (opening shops at /sell, "My shops" at /panel and the panel of
 * each shop at /panel/<slug>). Same keys as ../es/seller.ts. Shared commands come from m.commands
 * and are filled in with fmt().
 */
export const seller = {
  meta: {
    sell: "Sell on Cubezon",
    sellDescription:
      "Open your shop in the server's marketplace: an admin approves it, you deposit the stock in game and get paid in in-game money.",
    myShops: "My shops",
    overview: "Your shop at a glance",
    listings: "Your products",
    newListing: "New product",
    editListing: "Edit product",
    orders: "Your shop's orders",
    shop: "Your shop and its profile",
  },

  /**
   * Storage commands of the plugin, with their arguments (in-game commands only exist in English).
   * The zone commands are admin-only and never shown to sellers.
   */
  commands: {
    storage: "/cz storage",
    storageBuy: "/cz storage buy [type] [amount]",
  },

  pitch: {
    label: "Sell on Cubezon",
    title: "Open your shop in the server's marketplace",
    lead: "You bring the items and the price. Cubezon brings the storefront, the checkout and the lockers. All with in-game money.",
    perks: [
      { title: "Your storefront", body: "A page with your name, your stamp and all your products." },
      { title: "Automatic payment", body: "The server charges the buyer and the money lands in your balance." },
      { title: "No meetups", body: "Orders wait in lockers. You just deposit the stock." },
    ],
  },

  steps: {
    label: "How it works",
    title: "From your chest to their locker in six steps",
    items: [
      { title: "Request your shop", body: "Pick a name, a link and an ink. It takes a minute." },
      {
        title: "An admin reviews it",
        body: "They check that the shop follows the server rules. If something's off, they'll tell you what to fix.",
      },
      { title: "Create your products", body: "Which item you sell, how many go in each bundle and at what price." },
      {
        title: "Deposit the stock in game",
        body: "Place storage blocks in your shop's zone (an admin marks it), use {command} and put the items into the product. No deposit, no sale.",
      },
      { title: "Buyers place orders", body: "They choose how many bundles they want and which locker to pick them up from." },
      {
        title: "You get paid in game",
        body: "When the server processes the order, the money lands in your balance and the items go to the locker.",
      },
    ],
  },

  rules: {
    title: "Fine print (but readable)",
    items: [
      "Each player has one shop slot. If you need more, ask an admin. Rejected requests don't count.",
      "In-game money only: nobody pays with real money here.",
      "You only sell what you've deposited. Cubezon doesn't create items out of thin air.",
      "Deposited items stay in escrow until someone buys them.",
      "An admin can suspend a shop that breaks the rules.",
    ],
  },

  gate: {
    title: "Sign in to open your shop",
    body: "Link your Minecraft account with {command} and sign in with the code. That's how we know whose shop it is.",
    cta: "Sign in and request a shop",
  },

  apply: {
    label: "Request",
    title: "Request your shop",
    titleAnother: "Request another shop",
    lead: "An admin will review it before it opens to the public.",
    /** Plural on the slots ({count}); {used} = shops already using one. */
    count: { one: "You have {used} of {count} shop.", other: "You have {used} of {count} shops." },
    countHint: "Rejected requests don't count.",
    submit: "Send request",
    submitting: "Sending…",
    saved: "Request sent. It's now in \"Your shops\", waiting for review.",
    resubmit: "Send again",
    fix: "Fix and resend",
    fixLimit:
      "To resend this request you need a free slot, and you have none left.",
    limit: {
      title: "You've reached your shop limit",
      body: "Your open, under-review or suspended shops already use all your slots. Rejected requests don't count.",
      cta: "Go to my shops",
    },
  },

  myShops: {
    label: "Your requests",
    title: "Your shops",
    seeAll: "Go to my shops",
  },

  shopStatus: {
    title: {
      PENDING: "Request under review",
      APPROVED: "Shop open",
      REJECTED: "Request rejected",
      SUSPENDED: "Shop suspended",
    },
    body: {
      PENDING: "An admin will review {name} shortly. Meanwhile, you can start preparing its products in the panel.",
      APPROVED: "{name} is now in the catalog. Manage its products and orders from its panel.",
      REJECTED: "Fix whatever is needed and send it again. It will go back to review.",
      SUSPENDED:
        "{name} doesn't appear in the catalog and can't sell. If you think it's a mistake, talk to a server admin.",
    },
    reviewNote: "Admin note",
    goToPanel: "Go to panel",
    preparePanel: "Prepare products",
    viewShop: "View storefront",
  },

  shopForm: {
    name: "Shop name",
    nameHint: "Between 3 and 40 characters.",
    namePlaceholder: "Paco's Mines",
    slug: "Link",
    slugHint: "Lowercase letters, numbers and hyphens. Filled in from the name and must be unique.",
    slugHintExisting:
      "Lowercase letters, numbers and hyphens. If you change it, old links will still lead to your shop; in game commands, use the new one.",
    slugPrefix: "/t/",
    description: "Description",
    descriptionHint: "What you sell and why from you. Up to 500 characters.",
    descriptionPlaceholder: "Well-enchanted diamond pickaxes and wool in every color.",
    counter: "{count}/{max}",
    ink: "Ink",
    inkHint: "The color of your stamp and your name in the catalog.",
    preview: "How it will look",
    previewName: "Your shop",
    save: "Save changes",
    saving: "Saving…",
    saved: "Changes saved.",
  },

  /** Shop settings page (/panel/<slug>/shop): its sections. */
  settings: {
    details: "Shop details",
    detailsLead: "You can change the name and the link whenever you want: no new review needed.",
  },

  /** Public profile of a shop (/panel/<slug>/shop): images, tagline, featured listings, location. */
  profile: {
    title: "Public profile",
    lead: "What buyers see on your storefront and in the shop directory.",
    preview: "Preview",
    previewHint: "This is how your storefront header looks with the saved changes.",
    tagline: "Tagline",
    taglineHint: "A short sentence under the name. Up to 80 characters.",
    taglinePlaceholder: "Pickaxes that don't break on the first swing.",
    featured: "Featured products",
    featuredHint: "Choose up to {max} active products. They show at the very top of your storefront.",
    featuredCount: "{count}/{max}",
    featuredStock: "Available: {count}",
    featuredEmpty: "You have no active products to feature. Paused ones don't count.",
    featuredNote: "If you pause or remove a featured product, it stops showing.",
    location: "Show where the shop is",
    locationHint: "Show the world and coordinates of your shop's zone on your storefront.",
    locationNoZone: "Your shop has no zone yet: nothing will show until an admin marks it.",
    save: "Save profile",
    saving: "Saving…",
    saved: "Profile saved.",
  },

  /** The shop's own express fee (/panel/<slug>/shop), when the server lets shops set it. */
  expressFee: {
    title: "Express delivery price",
    lead: "What buyers pay to get your order in their mailbox: once per purchase at your shop.",
    serverFee: "Server price",
    cap: "Maximum allowed",
    current: "You currently charge",
    field: "Your price",
    placeholder: "Empty = {fee}",
    hint: "Leave it empty to use the server price. 0 = free delivery.",
    save: "Save price",
    saving: "Saving…",
    saved: "Delivery price saved.",
  },

  /** Logo and banner uploads of the public profile. */
  images: {
    title: "Images",
    logo: {
      title: "Logo",
      hint: "Square, at least 128 × 128 px. PNG, JPG or WebP up to 2 MB.",
      upload: "Upload logo",
      remove: "Remove logo",
      saved: "Logo updated.",
      removed: "Logo removed. Your initials are back.",
      empty: "No logo: your initials are used.",
    },
    banner: {
      title: "Banner",
      hint: "Wide, for example 1200 × 300 px. PNG, JPG or WebP up to 2 MB.",
      upload: "Upload banner",
      remove: "Remove banner",
      saved: "Banner updated.",
      removed: "Banner removed.",
      empty: "No banner: a strip of your ink is used.",
    },
    photo: {
      title: "Product photo",
      hint: "Shown in the catalog and on the product page. PNG, JPG or WebP up to 2 MB. An admin can remove it if it isn't appropriate.",
      upload: "Upload photo",
      remove: "Remove photo",
      saved: "Photo updated.",
      removed: "Photo removed. The item icon is back.",
      empty: "No photo: the item icon is shown.",
    },
    current: "Current image",
    selected: "Selected image (not uploaded yet)",
    uploading: "Uploading…",
    removing: "Removing…",
  },

  inks: {
    azul: "Stamp blue",
    burdeos: "Burgundy",
    botella: "Bottle green",
    violeta: "Violet",
    petroleo: "Petrol",
    sepia: "Sepia",
    grafito: "Graphite",
    teja: "Terracotta",
  },

  /** "My shops" (/panel): one card per shop of the player. */
  shops: {
    label: "Seller panel",
    title: "My shops",
    open: "Open panel",
    fixRequest: "Fix request",
    kpis: {
      unitsSold: "Sold",
      revenue: "Revenue",
      openOrders: "In progress",
      stock: "Available",
    },
    storage: "Storage",
    storageUsage: "{used}/{capacity}",
    noZone: "No zone",
    another: {
      title: "Request another shop",
      body: "You're using {used} of {slots}. An admin reviews every request.",
    },
    limit: {
      title: "No free slots",
      usage: "You're using {used} of {slots}.",
      body: "You've reached your shop limit.",
    },
  },

  panel: {
    label: "Shop panel",
    myShops: "My shops",
    switchShop: "Switch shop",
    nav: {
      label: "Panel sections",
      overview: "Overview",
      listings: "Products",
      orders: "Orders",
      shop: "Shop",
    },
    viewShop: "View storefront",
  },

  overview: {
    title: "Overview",
    kpis: {
      unitsSold: "Units sold",
      unitsSoldHint: "Orders paid, in a locker or collected",
      revenue: "Revenue",
      revenueHint: "Total of charged orders",
      openOrders: "Orders in progress",
      openOrdersHint: "Pending, paid or in a locker",
      stock: "Available stock",
      stockHint: "Deposited units not yet sold",
    },
    statusTitle: "Shop status",
    status: {
      PENDING:
        "An admin is reviewing your request. You can prepare products, but they won't show and you can't deposit until it's approved.",
      APPROVED: "Your shop is public. Active products with stock appear in the catalog.",
      REJECTED: "Your request was rejected. Fix it and send it again from the seller page.",
      SUSPENDED: "Your shop is suspended: it doesn't appear in the catalog and you can't make changes.",
    },
    fixRequest: "Fix request",
    recentOrders: "Recent orders",
    noOrders: {
      title: "No orders yet",
      body: "The first customer always keeps you waiting. Make sure you have stock deposited.",
    },
    lowStock: "Low stock",
    lowStockEmpty: "All your active products are well stocked.",
    stockLeft: { zero: "Out of stock", one: "{count} unit left", other: "{count} units left" },
    restock: "Restock",
  },

  /** Storage block of the overview: capacity from the "Cubezon Storage" blocks in the shop zone. */
  storage: {
    title: "Storage",
    meterLabel: "Storage usage",
    usage: "{used} of {capacity} units",
    usageHint: "Counts available units and those reserved in orders.",
    blocks: {
      zero: "No storage blocks in the zone",
      one: "{count} storage block in the zone",
      other: "{count} storage blocks in the zone",
    },
    noZone: "Your shop has no zone yet: ask an admin to mark it in game.",
    noBlocks:
      "To deposit, you need storage blocks placed inside your shop's zone (27 units each). Buy them with {command} or craft them.",
    full: "Storage full: you can't deposit more until you place another storage block in the zone or sell stock.",
    more: "Need more room? Buy storage blocks with {command} or craft them, and place them inside the zone.",
    check: "In game, {command} tells you how much is used.",
  },

  /** Shop zone in the game (set by an admin), shown on the shop settings page. */
  zone: {
    title: "Zone in game",
    world: "World",
    from: "From",
    to: "To",
    coords: "{x}, {y}, {z}",
    hint: "Storage blocks only count if they're inside this zone.",
  },

  listings: {
    title: "Products",
    new: "New product",
    caption: "Your shop's products",
    columns: {
      item: "Item",
      title: "Product",
      price: "Price",
      unit: "Bundle",
      stock: "Available",
      sold: "Sold",
      status: "Status",
      actions: "Actions",
    },
    reserved: { one: "+{count} reserved", other: "+{count} reserved" },
    edit: "Edit",
    pause: "Pause",
    activate: "Activate",
    remove: "Remove",
    confirmRemove: "Remove \"{title}\"? It disappears from the catalog. If you sell it again, you can restore it from this list.",
    restore: "Restore",
    restoring: "Restoring…",
    cannotRemove: "It has stock in escrow or orders in progress: for now you can only pause it.",
    empty: {
      title: "Not a product in sight",
      body: "Create the first one and deposit the stock in game to start selling.",
      cta: "Create product",
    },
    flash: {
      created: "Product created. Now deposit the stock in game with {command}.",
      saved: "Changes saved.",
    },
    notPublic: "Your products won't appear in the catalog until an admin approves the shop.",
    suspended: "This shop is suspended: you can't create or change products.",
    readOnly: "Your rank doesn't allow managing products: you can view them, but not create or change them.",
  },

  listingForm: {
    title: "Title",
    titleHint: "Between 3 and 60 characters. It's the first thing the buyer reads.",
    titlePlaceholder: "Diamond Pickaxe with Efficiency V",
    description: "Description",
    descriptionHint: "Enchantments, condition or anything you want to say. Up to 500 characters.",
    material: "In-game item",
    materialHint: "The item's in-game id, like diamond_pickaxe. Type to see suggestions.",
    materialPlaceholder: "diamond_pickaxe",
    materialPreview: "Item preview",
    materialPreviewEmpty: "Type an id to see the item.",
    unitAmount: "Items per bundle",
    unitAmountHint: "How many items the buyer gets per unit. Between 1 and 64 (one stack).",
    unitAmountHintStack:
      "How many items the buyer gets per unit. Each bundle is a single stack and this item allows at most {max}.",
    unitPrice: "Price per bundle",
    unitPriceHint: "In in-game money. Up to 2 decimals: 12.50.",
    unitPricePlaceholder: "0.00",
    perItem: "That's {price} per item.",
    status: "Status",
    statusOptions: {
      ACTIVE: "Active: on sale as soon as there's stock",
      PAUSED: "Paused: out of the catalog, but you can restock",
    },
    locked:
      "This product already has deposited items, so the item and the items per bundle can't change. If you need another format, create a new product.",
    create: "Publish product",
    creating: "Publishing…",
    save: "Save changes",
    saving: "Saving…",
    saved: "Changes saved.",
    back: "Back to products",
    removed: "This product is removed. Restore it to edit it and sell it again: it comes back paused.",
    restored: "Product restored. It's paused: check the price and activate it whenever you want to sell it again.",
    inventory: {
      title: "Inventory",
      available: "Available",
      reserved: "Reserved",
      delivered: "Delivered",
      returned: "Returned",
    },
  },

  deposit: {
    title: "How to add stock",
    join: "Join the server with your Minecraft account.",
    command: "Type {command} and choose the product (active or paused).",
    stack: "Put in stacks of exactly {amount} × {item}. Each stack is one unit for sale.",
    stackAny: "Put in stacks of the product's item with its exact items per bundle. Each stack is one unit for sale.",
    appears: "The stock shows in the panel as soon as the server saves it.",
    note: "Only what matches the product's item and items per bundle is accepted. Everything else goes back to your inventory.",
    storage: "Each unit takes up room in the storage blocks in your shop's zone. Check what's left with {command}.",
    notApproved: "You can deposit once an admin approves your shop.",
  },

  orders: {
    title: "Orders",
    caption: "Your shop's orders",
    filterLabel: "Filter by status",
    filters: {
      all: { label: "All" },
      open: { label: "In progress" },
      PENDING: { label: "Pending" },
      PAID: { label: "Paid" },
      READY: { label: "In locker" },
      COLLECTED: { label: "Collected" },
      FAILED: { label: "Failed or canceled" },
      REFUNDED: { label: "Refunded" },
    },
    columns: {
      number: "Order",
      date: "Date",
      buyer: "Buyer",
      listing: "Product",
      units: "Units",
      total: "Total",
      locker: "Delivery",
      status: "Status",
    },
    mailbox: "Mailbox (express)",
    expressExtra: "+{amount} express",
    tipExtra: "+{amount} tip",
    items: { one: "{count} item", other: "{count} items" },
    count: { zero: "No orders", one: "{count} order", other: "{count} orders" },
    unknownBuyer: "Unknown player",
    empty: {
      title: "No orders around here",
      body: "When someone buys from your shop, you'll see it in this list.",
    },
    emptyFiltered: {
      title: "Nothing with this status",
      body: "Try another filter.",
    },
    pagination: {
      newer: "Newer",
      older: "Older",
      page: "Page {page} of {pages}",
    },
  },

  errors: {
    nameLength: "The name must be between 3 and 40 characters.",
    slugFormat: "The link must be between 3 and 40 characters: lowercase letters, numbers and hyphens.",
    slugTaken: "Another shop uses or used that link. Try a different one.",
    descriptionLength: "The description can't exceed 500 characters.",
    inkInvalid: "Choose one of the inks.",
    titleLength: "The title must be between 3 and 60 characters.",
    materialFormat:
      "Enter the item id (lowercase letters, numbers and underscores, like diamond_pickaxe) or the key of a registered item.",
    itemUnknown:
      "That item from another plugin isn't registered. Ask an admin to register it in game with /cz item register.",
    unitAmountRange: "Items per bundle must be a whole number between 1 and 64.",
    unitAmountStack:
      "Each bundle is a single stack and this item allows at most {max} per stack. Lower the items per bundle.",
    priceFormat: "Enter the price with up to 2 decimals, for example 12.50.",
    priceRange: "The price must be greater than 0 and no more than 1,000,000,000.",
    statusInvalid: "Choose whether the product is active or paused.",
    taglineLength: "The tagline can't exceed 80 characters.",
    featuredTooMany: "You can feature at most 4 products.",
    expressFeeFormat: "Enter the price with up to 2 decimals, for example 12.50. Empty = the server's.",
    expressFeeRange: "Express delivery can't exceed {max}.",
    expressFeeLocked: "The server currently sets the same express delivery price for every shop: you can't change it.",
    imageMissing: "Choose an image.",
    imageType: "The image must be PNG, JPG or WebP.",
    imageSize: "The image can't exceed 2 MB.",
    shopLimit: "You've reached your shop limit.",
    shopNotFound: "That shop doesn't exist or isn't yours.",
    notRejected: "This request is no longer rejected. Reload the page to see where it stands.",
    suspended: "This shop is suspended: you can't make changes.",
    notFound: "That product doesn't exist or isn't from this shop.",
    removed: "This product is removed: restore it before changing it.",
    generic: "Couldn't save. Try again in a moment.",
    fixFields: "Check the highlighted fields.",
  },
} as const;
