/**
 * English texts: help. Same keys as ../es/help.ts. Placeholders: {command} is rendered as an in-game command chip and
 * {signIn}, {lockers}, {orders}, {sell}, {panel} as links to those pages.
 */
export const help = {
  meta: {
    title: "Help",
    description: "How to link your account, buy, pick up at a locker and sell on Cubezon.",
  },
  title: "How Cubezon works",
  lead: "A server marketplace with simple rules: shops deposit real items in the game, you pay with in-game money and pick up at a locker.",
  tocLabel: "On this page",
  stepLabel: "Step {number}",

  links: {
    signIn: "Sign in",
    lockers: "the locker list",
    orders: "My orders",
    sell: "Sell on Cubezon",
    panel: "your shop panel",
  },

  sections: {
    link: {
      label: "Account",
      title: "Link your account",
      steps: [
        "Join the Minecraft server.",
        "Type {command}. It gives you a 6-character code.",
        "Enter the code in {signIn} before it expires (it lasts a few minutes and works only once).",
      ],
      note: "No passwords: your web account is your game account. If the code expires, get another one.",
    },
    buy: {
      label: "Buying",
      title: "Buy",
      steps: [
        "Search for what you want or browse the categories.",
        "Choose how many units you want and how they reach you: at a locker or, if the server has it enabled, by express delivery to your mailbox.",
        "Confirm at checkout. The order stays pending until it is charged to your in-game balance (in roleplay mode, when the shop accepts it).",
      ],
      note: "Each unit is a batch: if a product says ×16, you get 16 items per unit. Track its status in {orders}.",
    },
    pickup: {
      label: "Pickup",
      title: "Pick up an order",
      steps: [
        "Wait until the order says \"At locker\" in {orders}.",
        "Go to the locker you chose. The coordinates are in {lockers}.",
        "Right-click the locker block or use {command} within 5 blocks, and choose the order from the menu.",
      ],
      note: "You can only pick up your own orders, and only at the locker you chose at checkout. Bring as many free inventory slots as the order has units.",
    },
    sell: {
      label: "Selling",
      title: "Sell on Cubezon",
      steps: [
        "Apply for your shop at {sell}. An admin reviews it before it opens.",
        "Once approved, create products from {panel}: title, item, items per unit and price.",
        "Deposit the stock in the game. No deposited stock, no sales.",
      ],
      note: "You get paid in in-game money when the server processes each order (in roleplay mode, when the package reaches the locker).",
    },
    deposit: {
      label: "Stock",
      title: "Deposit stock",
      steps: [
        "In the game, type {command} and choose the product.",
        "Put the items in the menu. They must be the product's item, in stacks of exactly the unit size (16 if the product is ×16).",
        "Each accepted stack is one unit for sale. Enchantments, names and the rest are kept as they are.",
      ],
      note: "Anything that doesn't fit is not accepted and goes back to your inventory.",
    },
  },

  /** Roleplay order mode: how it works and the computer and employee commands. */
  roleplay: {
    label: "Roleplay mode",
    title: "Orders in roleplay mode",
    lead: "The server runs in one of two modes. In automatic mode, the server charges and prepares each order on its own. In roleplay mode, each shop handles its orders by hand from its \"Company Computer\", inside its zone in the game.",
    current: "Current mode",
    steps: [
      "You buy as usual. The order stays \"Waiting for the shop\" and you are not charged anything yet.",
      "The shop accepts or rejects it from its computer. When it accepts, you are charged and the money is held; if it rejects, you pay nothing.",
      "The shop prints a package and someone takes it to your locker. On delivery, the order becomes \"Ready for pickup\" and the shop gets paid.",
      "You pick it up as usual. If the shop does not accept or deliver it in time, it is cancelled: no charge, or your money back.",
    ],
    commandsTitle: "Commands for shops",
    commands: [
      { key: "computerBuy", text: "Buy Company Computers. Place them inside your shop's zone." },
      { key: "employeeAdd", text: "Let another player use your shop's computer." },
      { key: "employeeRemove", text: "Revokes their access." },
      { key: "employeeList", text: "Lists the shop's employees." },
      { key: "computerGive", text: "Admins only: gives computers to a player." },
    ],
    note: "<shop> is your shop's link (whatever comes after /t/). Employees are managed only by the owner or an admin; also from {panel}.",
  },

  faq: {
    label: "FAQ",
    title: "What everybody asks",
    items: [
      {
        q: "Do I pay with real money?",
        a: "No. Everything is paid with the server's in-game money. Nobody here will ask you for euros, cards or anything like that.",
      },
      {
        q: "What if I don't have enough balance?",
        a: "The order fails at no cost: the server charges you nothing and the order is marked \"Failed\". Get some balance and order again.",
      },
      {
        q: "What if it sells out while I'm buying?",
        a: "Only deposited stock is sold. If there is no stock left when the server processes your order, it fails without charging you anything.",
      },
      {
        q: "When am I charged?",
        a: "When the server processes the order or, in roleplay mode, when the shop accepts it; never when you click buy. If something goes wrong halfway, the order is marked as failed or fully refunded.",
      },
      {
        q: "What if the shop doesn't handle my order?",
        a: "In roleplay mode, if the shop does not accept it in time, it is cancelled without charging you anything. If it accepts but does not take it to the locker in time, your money is refunded.",
      },
      {
        q: "Can I get it without going to a locker?",
        a: "If the server has express delivery enabled, yes. Place your mailbox in the game (get one with /cz mailbox buy) and choose \"Express delivery to your mailbox\" at checkout. It costs an extra fee, once per purchase, and the order arrives on its own at your mailbox. Collect it by right-clicking it; /cz mailbox tells you where it is.",
      },
      {
        q: "Who can sell?",
        a: "Any player with a linked account can apply for a shop. It starts selling once an admin approves it.",
      },
      {
        q: "Can I review what I buy?",
        a: "Yes, once you have collected the order. That's why every review comes from a real purchase.",
      },
    ],
  },

  contact: {
    title: "Something still doesn't add up?",
    body: "Ask an admin on the server. Have your order number at hand.",
  },
} as const;
