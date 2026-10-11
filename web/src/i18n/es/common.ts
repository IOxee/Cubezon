/**
 * Spanish texts of the web. Tone: tú, short sentences, dry humour in secondary labels and
 * empty states, never in errors or anything about money. No emojis.
 */
export const common = {
  meta: {
    siteName: "Cubezon",
    tagline: "De la mina a tu taquilla",
    description:
      "El mercado del servidor: tiendas aprobadas venden objetos del juego por dinero del juego y tú los recoges en una taquilla.",
    titleTemplate: "%s · Cubezon",
  },

  a11y: {
    skipToContent: "Saltar al contenido",
    categoriesNav: "Categorías",
    siteNav: "Secciones de Cubezon",
    breadcrumbs: "Migas de pan",
    pagination: "Paginación",
    close: "Cerrar",
    openMenu: "Abrir menú",
    itemIcon: "Icono de {name}",
    avatar: "Avatar de {name}",
    shopSeal: "Sello de {name}",
    rating: "{rating} de 5",
    barcode: "Código de barras del pedido {code}",
    loading: "Cargando…",
  },

  money: {
    suffix: " $",
    perItem: "{price} / ud.",
    free: "Gratis",
  },

  common: {
    save: "Guardar",
    saving: "Guardando…",
    cancel: "Cancelar",
    edit: "Editar",
    delete: "Borrar",
    back: "Volver",
    seeAll: "Ver todo",
    seeMore: "Ver más",
    yes: "Sí",
    no: "No",
    optional: "opcional",
    required: "obligatorio",
    send: "Enviar",
    search: "Buscar",
    apply: "Aplicar",
    clear: "Quitar filtros",
    copy: "Copiar",
    copied: "Copiado",
    retry: "Reintentar",
    none: "—",
    serial: "Nº {serial}",
    newTag: "Nuevo",
    officialStamp: "Oficial",
    soldOutStamp: "Agotado",
    actions: "Acciones",
    status: "Estado",
    date: "Fecha",
    total: "Total",
  },

  header: {
    topbar: [
      "Recogida en taquillas de todo el servidor",
      "Solo dinero del juego",
      "¿Nuevo? Vincula tu cuenta con {command}",
    ],
    home: "Cubezon, portada",
    search: {
      label: "Buscar en Cubezon",
      placeholder: "Busca diamantes, picos, tartas…",
      scope: "Sección",
      allCategories: "Todo",
      submit: "Buscar",
    },
    account: {
      signIn: "Entrar",
      signInHint: "Vincula tu cuenta",
      hello: "Hola, {name}",
      myAccount: "Mi cuenta",
      menuLabel: "Accesos rápidos de tu cuenta",
      menu: {
        account: "Mi cuenta",
        shops: "Mis tiendas",
        sell: "Abrir una tienda",
        admin: "Administración",
        help: "Ayuda",
        signOut: "Cerrar sesión",
      },
    },
    categories: "Categorías",
    categoriesLabel: "Todas las categorías",
    orders: "Pedidos",
    ordersHint: "Seguimiento",
    cart: "Carrito",
    cartCount: { zero: "Carrito vacío", one: "{count} unidad en el carrito", other: "{count} unidades en el carrito" },
  },

  nav: {
    all: "Todo el catálogo",
    shops: "Tiendas",
    lockers: "Taquillas",
    sell: "Vender en Cubezon",
    help: "Ayuda",
    panel: "Mi tienda",
    admin: "Administración",
  },

  categories: {
    blocks: { name: "Bloques", blurb: "Para construir lo que sea" },
    tools: { name: "Herramientas", blurb: "Picos, hachas y compañía" },
    combat: { name: "Combate", blurb: "Espadas, arcos y escudos" },
    armor: { name: "Armaduras", blurb: "De cuero a netherita" },
    food: { name: "Comida", blurb: "Para no morir de hambre" },
    magic: { name: "Pociones y magia", blurb: "Libros, pociones y tótems" },
    redstone: { name: "Redstone", blurb: "Circuitos y mecanismos" },
    decoration: { name: "Decoración", blurb: "Que se note que es tu casa" },
    materials: { name: "Materiales", blurb: "Lingotes, gemas y polvos" },
    misc: { name: "Otros", blurb: "Lo que no cabe en otro cajón" },
  },

  worlds: {
    world: "Mundo normal",
    world_nether: "Nether",
    world_the_end: "El End",
  },

  /** Role of the player in a shop's panel. */
  panelRole: {
    owner: "Dueño",
    /** An employee whose rank has no name (should not happen: every member gets one). */
    employee: "Empleado",
  },

  theme: {
    label: "Tema",
    system: "Sistema",
    light: "Claro",
    dark: "Oscuro",
  },

  footer: {
    backToTop: "Volver arriba",
    columns: {
      buy: "Comprar",
      sell: "Vender",
      help: "Ayuda",
      account: "Tu cuenta",
    },
    links: {
      catalog: "Catálogo completo",
      shops: "Tiendas del servidor",
      lockers: "Taquillas de recogida",
      sell: "Abre tu tienda",
      panel: "Panel de vendedor",
      deposit: "Cómo depositar stock",
      howItWorks: "Cómo funciona",
      link: "Vincular la cuenta",
      pickup: "Recoger un pedido",
      account: "Mi cuenta",
      orders: "Mis pedidos",
      cart: "Carrito",
      styleGuide: "Lámina de estilo",
    },
    legal:
      "Cubezon es un proyecto de portfolio. No tiene relación con Amazon ni con Mojang. Solo se usa dinero del juego: aquí nadie paga con euros.",
    madeWith: "Impreso a dos tintas en un servidor de Minecraft.",
  },

  status: {
    order: {
      PENDING: "Pendiente de cobro",
      PAID: "Pagado",
      READY: "Listo para recoger",
      COLLECTED: "Recogido",
      FAILED: "Fallido",
      REFUNDED: "Reembolsado",
    },
    processing: "Procesando el pago",
    processingStamp: "Procesando",
    processingHelp: "El servidor está cobrando el pedido y reservando los objetos ahora mismo.",
    failureReason: {
      OUT_OF_STOCK: "La tienda se quedó sin stock antes de procesar tu pedido.",
      LISTING_UNAVAILABLE: "El producto o la tienda ya no están disponibles.",
      LOCKER_UNAVAILABLE: "La taquilla elegida se ha desactivado.",
      INVALID_ITEM: "Los objetos de la tienda estaban dañados y no se pudieron entregar.",
      INSUFFICIENT_FUNDS: "No tenías saldo suficiente en el juego.",
      PAYMENT_ERROR: "Hubo un error al cobrar en el juego.",
      INTERRUPTED: "El servidor se detuvo mientras procesaba el pedido. Un admin revisará el cobro.",
      PAYOUT_FAILED: "No se pudo pagar a la tienda, así que se te ha devuelto el dinero.",
      REFUND_FAILED: "Hubo un error grave al devolver el dinero. Un admin lo revisará.",
      MAILBOX_UNAVAILABLE: "Tu buzón ya no existe, así que no se pudo entregar.",
    },
    failureReasonUnknown: "Motivo: {code}",
    /** Express orders (delivery_method MAILBOX): they reach the buyer's mailbox, not a locker. */
    mailbox: {
      order: { READY: "En tu buzón" },
      stamp: { READY: "En tu buzón" },
      help: {
        PAID: "Cobrado. Llegará a tu buzón enseguida, sin pasar por la taquilla.",
        READY:
          "Tu pedido te espera en tu buzón. Haz clic derecho en él para recogerlo, con tantos huecos libres en el inventario como unidades tenga el pedido.",
      },
      steps: { READY: "En tu buzón" },
    },
    /** FAILED orders the shop rejected or nobody accepted in time (not an error: nothing was charged). */
    cancelled: {
      order: "Cancelado",
      stamp: "Cancelado",
      help: "No se te ha cobrado nada.",
    },
    orderStamp: {
      PENDING: "Pendiente",
      PAID: "Pagado",
      READY: "En taquilla",
      COLLECTED: "Recogido",
      FAILED: "Fallido",
      REFUNDED: "Reembolsado",
    },
    orderHelp: {
      PENDING: "El servidor cobrará el pedido de tu saldo en el juego en cuanto lo procese.",
      PAID: "Cobrado. La tienda está preparando tu pedido para dejarlo en la taquilla.",
      READY: "Tu pedido te espera en la taquilla. Haz clic derecho en ella o usa {command} a 5 bloques o menos, con tantos huecos libres en el inventario como unidades tenga el pedido.",
      COLLECTED: "Recogido. Que lo disfrutes.",
      FAILED: "No se pudo completar el pedido y no se te ha cobrado nada.",
      REFUNDED: "El importe se ha devuelto a tu saldo en el juego.",
    },
    shop: {
      PENDING: "En revisión",
      APPROVED: "Aprobada",
      REJECTED: "Rechazada",
      SUSPENDED: "Suspendida",
    },
    listing: {
      ACTIVE: "Activo",
      PAUSED: "Pausado",
      REMOVED: "Retirado",
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
    soldBy: "Vendido por",
    officialShop: "Tienda oficial",
    unit: { one: "{count} objeto por unidad", other: "{count} objetos por unidad" },
    unitShort: "×{count}",
    stock: {
      zero: "Agotado",
      one: "Queda {count} unidad",
      other: "Quedan {count} unidades",
    },
    lowStock: "Últimas unidades",
    sold: { one: "{count} vendida", other: "{count} vendidas" },
    ratingCount: { zero: "Sin valoraciones", one: "{count} valoración", other: "{count} valoraciones" },
    noRatings: "Sin valoraciones",
    pricePerItem: "Sale a {price} cada objeto",
    listingNumber: "Producto",
  },

  empty: {
    catalog: {
      title: "El almacén está vacío",
      body: "Las tiendas todavía no han depositado nada. Vuelve en un rato o, mejor, abre la tuya.",
      cta: "Quiero vender",
    },
  },

  errors: {
    generic: {
      title: "Algo se ha roto en el almacén",
      body: "No es culpa tuya. Vuelve a intentarlo y, si sigue fallando, avisa a un admin del servidor.",
    },
    notFound: {
      title: "Este bloque no existe",
      body: "La página que buscas se ha caído a la lava o nunca estuvo aquí.",
      home: "Ir a la portada",
    },
  },
} as const;
