/**
 * Spanish texts: seller area (opening shops at /sell, "Mis tiendas" at /panel and the panel of
 * each shop at /panel/<slug>). Shared commands come from m.commands and are filled in with fmt().
 */
export const seller = {
  meta: {
    sell: "Vende en Cubezon",
    sellDescription:
      "Abre tu tienda en el mercado del servidor: un admin la aprueba, depositas el stock en el juego y cobras en dinero del juego.",
    myShops: "Mis tiendas",
    overview: "Resumen de tu tienda",
    listings: "Tus productos",
    newListing: "Nuevo producto",
    editListing: "Editar producto",
    orders: "Pedidos de tu tienda",
    shop: "Tu tienda y su perfil",
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
    label: "Vender en Cubezon",
    title: "Abre tu tienda en el mercado del servidor",
    lead: "Tú pones los objetos y el precio. Cubezon pone el escaparate, la caja y las taquillas. Todo con dinero del juego.",
    perks: [
      { title: "Tu escaparate", body: "Una página con tu nombre, tu sello y todos tus productos." },
      { title: "Cobro automático", body: "El servidor cobra al comprador y el dinero entra en tu saldo." },
      { title: "Sin quedar con nadie", body: "Los pedidos esperan en taquillas. Tú solo depositas el stock." },
    ],
  },

  steps: {
    label: "Cómo funciona",
    title: "De tu cofre a su taquilla en seis pasos",
    items: [
      { title: "Solicita tu tienda", body: "Elige nombre, enlace y tinta. Te lleva un minuto." },
      {
        title: "Un admin la revisa",
        body: "Comprueba que la tienda cumple las normas del servidor. Si algo no encaja, te dice qué corregir.",
      },
      { title: "Crea tus productos", body: "Qué objeto vendes, cuántos van en cada lote y a qué precio." },
      {
        title: "Deposita el stock en el juego",
        body: "Coloca almacenes en la zona de tu tienda (la marca un admin), usa {command} y mete los objetos en el producto. Sin depósito no hay venta.",
      },
      { title: "Los compradores piden", body: "Eligen cuántos lotes quieren y en qué taquilla recogerlos." },
      {
        title: "Cobras en el juego",
        body: "Cuando el servidor procesa el pedido, el dinero entra en tu saldo y los objetos van a la taquilla.",
      },
    ],
  },

  rules: {
    title: "Letra pequeña (pero legible)",
    items: [
      "Cada jugador tiene un slot de tiendas. Si necesitas más, pídeselo a un admin. Las solicitudes rechazadas no cuentan.",
      "Solo dinero del juego: aquí nadie paga con euros.",
      "Solo vendes lo que has depositado. Cubezon no crea objetos de la nada.",
      "Lo depositado queda en custodia hasta que alguien lo compra.",
      "Un admin puede suspender una tienda que incumpla las normas.",
    ],
  },

  gate: {
    title: "Entra para abrir tu tienda",
    body: "Vincula tu cuenta de Minecraft con {command} y entra con el código. Así sabemos de quién es la tienda.",
    cta: "Entrar y solicitar tienda",
  },

  apply: {
    label: "Solicitud",
    title: "Solicita tu tienda",
    titleAnother: "Solicita otra tienda",
    lead: "Un admin la revisará antes de abrirla al público.",
    /** Plural on the slots ({count}); {used} = shops already using one. */
    count: { one: "Tienes {used} de {count} tienda.", other: "Tienes {used} de {count} tiendas." },
    countHint: "Las solicitudes rechazadas no cuentan.",
    submit: "Enviar solicitud",
    submitting: "Enviando…",
    saved: "Solicitud enviada. Ya la tienes en «Tus tiendas», a la espera de revisión.",
    resubmit: "Volver a enviar",
    fix: "Corregir y reenviar",
    fixLimit:
      "Para reenviar esta solicitud necesitas un slot libre y no te queda ninguno.",
    limit: {
      title: "Has alcanzado tu límite de tiendas",
      body: "Tus tiendas abiertas, en revisión o suspendidas ya ocupan todos tus slots. Las solicitudes rechazadas no cuentan.",
      cta: "Ir a mis tiendas",
    },
  },

  myShops: {
    label: "Tus solicitudes",
    title: "Tus tiendas",
    seeAll: "Ir a mis tiendas",
  },

  shopStatus: {
    title: {
      PENDING: "Solicitud en revisión",
      APPROVED: "Tienda abierta",
      REJECTED: "Solicitud rechazada",
      SUSPENDED: "Tienda suspendida",
    },
    body: {
      PENDING: "Un admin revisará {name} en breve. Mientras, puedes ir preparando sus productos en el panel.",
      APPROVED: "{name} ya está en el catálogo. Gestiona sus productos y pedidos desde su panel.",
      REJECTED: "Corrige lo que haga falta y vuelve a enviarla. Pasará otra vez a revisión.",
      SUSPENDED:
        "{name} no aparece en el catálogo y no puede vender. Si crees que es un error, habla con un admin del servidor.",
    },
    reviewNote: "Nota del admin",
    goToPanel: "Ir al panel",
    preparePanel: "Preparar productos",
    viewShop: "Ver escaparate",
  },

  shopForm: {
    name: "Nombre de la tienda",
    nameHint: "Entre 3 y 40 caracteres.",
    namePlaceholder: "Minas Paco",
    slug: "Enlace",
    slugHint: "Minúsculas, números y guiones. Se rellena solo a partir del nombre y no puede repetirse.",
    slugHintExisting:
      "Minúsculas, números y guiones. Si lo cambias, los enlaces antiguos seguirán llevando a tu tienda; en los comandos del juego, usa el nuevo.",
    slugPrefix: "/t/",
    description: "Descripción",
    descriptionHint: "Qué vendes y por qué a ti. Hasta 500 caracteres.",
    descriptionPlaceholder: "Picos de diamante bien encantados y lana de todos los colores.",
    counter: "{count}/{max}",
    ink: "Tinta",
    inkHint: "El color de tu sello y de tu nombre en el catálogo.",
    preview: "Así se verá",
    previewName: "Tu tienda",
    save: "Guardar cambios",
    saving: "Guardando…",
    saved: "Cambios guardados.",
  },

  /** Shop settings page (/panel/<slug>/shop): its sections. */
  settings: {
    details: "Datos de la tienda",
    detailsLead: "Puedes cambiar el nombre y el enlace cuando quieras: no hace falta otra revisión.",
  },

  /** Public profile of a shop (/panel/<slug>/shop): images, tagline, featured listings, location. */
  profile: {
    title: "Perfil público",
    lead: "Lo que ven los compradores en tu escaparate y en el directorio de tiendas.",
    preview: "Vista previa",
    previewHint: "Así se ve la cabecera de tu escaparate con los cambios guardados.",
    tagline: "Lema",
    taglineHint: "Una frase corta bajo el nombre. Hasta 80 caracteres.",
    taglinePlaceholder: "Picos que no se rompen a la primera.",
    featured: "Productos destacados",
    featuredHint: "Elige hasta {max} productos activos. Salen arriba del todo en tu escaparate.",
    featuredCount: "{count}/{max}",
    featuredStock: "Disponible: {count}",
    featuredEmpty: "No tienes productos activos que destacar. Los pausados no cuentan.",
    featuredNote: "Si pausas o retiras un producto destacado, deja de salir.",
    location: "Mostrar dónde está la tienda",
    locationHint: "Enseña en tu escaparate el mundo y las coordenadas de la zona de tu tienda.",
    locationNoZone: "Tu tienda aún no tiene zona: no se verá nada hasta que un admin la marque.",
    save: "Guardar perfil",
    saving: "Guardando…",
    saved: "Perfil guardado.",
  },

  /** Logo and banner uploads of the public profile. */
  images: {
    title: "Imágenes",
    logo: {
      title: "Logo",
      hint: "Cuadrado, de al menos 128 × 128 px. PNG, JPG o WebP de hasta 2 MB.",
      upload: "Subir logo",
      remove: "Quitar logo",
      saved: "Logo actualizado.",
      removed: "Logo quitado. Vuelven tus iniciales.",
      empty: "Sin logo: se usan tus iniciales.",
    },
    banner: {
      title: "Portada",
      hint: "Ancha, por ejemplo 1200 × 300 px. PNG, JPG o WebP de hasta 2 MB.",
      upload: "Subir portada",
      remove: "Quitar portada",
      saved: "Portada actualizada.",
      removed: "Portada quitada.",
      empty: "Sin portada: se usa la franja de tu tinta.",
    },
    photo: {
      title: "Foto del producto",
      hint: "Se ve en el catálogo y en la ficha. PNG, JPG o WebP de hasta 2 MB. Un admin puede quitarla si no es adecuada.",
      upload: "Subir foto",
      remove: "Quitar foto",
      saved: "Foto actualizada.",
      removed: "Foto quitada. Vuelve el icono del objeto.",
      empty: "Sin foto: se muestra el icono del objeto.",
    },
    current: "Imagen actual",
    selected: "Imagen elegida (aún sin subir)",
    uploading: "Subiendo…",
    removing: "Quitando…",
  },

  inks: {
    azul: "Azul tampón",
    burdeos: "Burdeos",
    botella: "Botella",
    violeta: "Violeta",
    petroleo: "Petróleo",
    sepia: "Sepia",
    grafito: "Grafito",
    teja: "Teja",
  },

  /** "Mis tiendas" (/panel): one card per shop of the player. */
  shops: {
    label: "Panel de vendedor",
    title: "Mis tiendas",
    open: "Abrir panel",
    fixRequest: "Corregir solicitud",
    kpis: {
      unitsSold: "Vendidas",
      revenue: "Ingresos",
      openOrders: "En curso",
      stock: "Disponible",
    },
    storage: "Almacén",
    storageUsage: "{used}/{capacity}",
    noZone: "Sin zona",
    another: {
      title: "Solicitar otra tienda",
      body: "Llevas {used} de {slots}. Un admin revisa cada solicitud.",
    },
    limit: {
      title: "Sin slots libres",
      usage: "Llevas {used} de {slots}.",
      body: "Has alcanzado tu límite de tiendas.",
    },
  },

  panel: {
    label: "Panel de tienda",
    myShops: "Mis tiendas",
    switchShop: "Cambiar de tienda",
    nav: {
      label: "Secciones del panel",
      overview: "Resumen",
      listings: "Productos",
      orders: "Pedidos",
      shop: "Tienda",
    },
    viewShop: "Ver escaparate",
  },

  overview: {
    title: "Resumen",
    kpis: {
      unitsSold: "Unidades vendidas",
      unitsSoldHint: "Pedidos pagados, en taquilla o recogidos",
      revenue: "Ingresos",
      revenueHint: "Suma de los pedidos cobrados",
      openOrders: "Pedidos en curso",
      openOrdersHint: "Pendientes, pagados o en taquilla",
      stock: "Stock disponible",
      stockHint: "Unidades depositadas sin vender",
    },
    statusTitle: "Estado de la tienda",
    status: {
      PENDING:
        "Un admin está revisando tu solicitud. Puedes preparar productos, pero no se verán ni podrás depositar hasta la aprobación.",
      APPROVED: "Tu tienda es pública. Los productos activos con stock aparecen en el catálogo.",
      REJECTED: "Tu solicitud fue rechazada. Corrígela y vuelve a enviarla desde la página de vendedor.",
      SUSPENDED: "Tu tienda está suspendida: no aparece en el catálogo y no puedes hacer cambios.",
    },
    fixRequest: "Corregir solicitud",
    recentOrders: "Pedidos recientes",
    noOrders: {
      title: "Todavía no hay pedidos",
      body: "El primer cliente siempre se hace esperar. Asegúrate de tener stock depositado.",
    },
    lowStock: "Poco stock",
    lowStockEmpty: "Todos tus productos activos están bien surtidos.",
    stockLeft: { zero: "Sin stock", one: "Queda {count} unidad", other: "Quedan {count} unidades" },
    restock: "Reponer",
  },

  /** Storage block of the overview: capacity from the "Almacén Cubezon" blocks in the shop zone. */
  storage: {
    title: "Almacén",
    meterLabel: "Ocupación del almacén",
    usage: "{used} de {capacity} unidades",
    usageHint: "Cuentan las unidades disponibles y las reservadas en pedidos.",
    blocks: {
      zero: "Ningún almacén en la zona",
      one: "{count} almacén en la zona",
      other: "{count} almacenes en la zona",
    },
    noZone: "Tu tienda aún no tiene zona: pide a un admin que la marque en el juego.",
    noBlocks:
      "Para depositar necesitas almacenes colocados dentro de la zona de tu tienda (27 unidades cada uno). Cómpralos con {command} o fabrícalos.",
    full: "Almacén lleno: no podrás depositar más hasta que coloques otro almacén en la zona o vendas stock.",
    more: "¿Necesitas más sitio? Compra almacenes con {command} o fabrícalos, y colócalos dentro de la zona.",
    check: "En el juego, {command} te dice cuánto ocupa.",
  },

  /** Shop zone in the game (set by an admin), shown on the shop settings page. */
  zone: {
    title: "Zona en el juego",
    world: "Mundo",
    from: "Desde",
    to: "Hasta",
    coords: "{x}, {y}, {z}",
    hint: "Los almacenes solo cuentan si están dentro de esta zona.",
  },

  listings: {
    title: "Productos",
    new: "Nuevo producto",
    caption: "Productos de tu tienda",
    columns: {
      item: "Objeto",
      title: "Producto",
      price: "Precio",
      unit: "Lote",
      stock: "Disponible",
      sold: "Vendidas",
      status: "Estado",
      actions: "Acciones",
    },
    reserved: { one: "+{count} reservada", other: "+{count} reservadas" },
    edit: "Editar",
    pause: "Pausar",
    activate: "Activar",
    remove: "Retirar",
    confirmRemove: "¿Retirar «{title}»? Desaparece del catálogo. Si vuelves a venderlo, puedes recuperarlo desde esta lista.",
    restore: "Recuperar",
    restoring: "Recuperando…",
    cannotRemove: "Tiene stock en custodia o pedidos en curso: de momento solo puedes pausarlo.",
    empty: {
      title: "Ni un producto a la vista",
      body: "Crea el primero y deposita el stock en el juego para empezar a vender.",
      cta: "Crear producto",
    },
    flash: {
      created: "Producto creado. Ahora deposita el stock en el juego con {command}.",
      saved: "Cambios guardados.",
    },
    notPublic: "Tus productos no aparecerán en el catálogo hasta que un admin apruebe la tienda.",
    suspended: "Esta tienda está suspendida: no puedes crear ni cambiar productos.",
    readOnly: "Tu rango no permite gestionar productos: puedes verlos, pero no crearlos ni cambiarlos.",
  },

  listingForm: {
    title: "Título",
    titleHint: "Entre 3 y 60 caracteres. Es lo primero que lee el comprador.",
    titlePlaceholder: "Pico de diamante con Eficiencia V",
    description: "Descripción",
    descriptionHint: "Encantamientos, estado o lo que quieras contar. Hasta 500 caracteres.",
    material: "Objeto del juego",
    materialHint: "Id del objeto en el juego, como diamond_pickaxe. Escribe para ver sugerencias.",
    materialPlaceholder: "diamond_pickaxe",
    materialPreview: "Vista previa del objeto",
    materialPreviewEmpty: "Escribe un id para ver el objeto.",
    unitAmount: "Objetos por lote",
    unitAmountHint: "Cuántos objetos recibe el comprador por cada unidad. Entre 1 y 64 (una pila).",
    unitAmountHintStack:
      "Cuántos objetos recibe el comprador por cada unidad. Cada lote es una sola pila y este objeto admite como mucho {max}.",
    unitPrice: "Precio por lote",
    unitPriceHint: "En dinero del juego. Puedes usar coma decimal: 12,50.",
    unitPricePlaceholder: "0,00",
    perItem: "Sale a {price} cada objeto.",
    status: "Estado",
    statusOptions: {
      ACTIVE: "Activo: a la venta en cuanto haya stock",
      PAUSED: "Pausado: fuera del catálogo, pero puedes reponer stock",
    },
    locked:
      "Este producto ya tiene objetos depositados, así que el objeto y los objetos por lote no se pueden cambiar. Si necesitas otro formato, crea un producto nuevo.",
    create: "Publicar producto",
    creating: "Publicando…",
    save: "Guardar cambios",
    saving: "Guardando…",
    saved: "Cambios guardados.",
    back: "Volver a productos",
    removed: "Este producto está retirado. Recupéralo para editarlo y volver a venderlo: vuelve en pausa.",
    restored: "Producto recuperado. Está en pausa: revisa el precio y actívalo cuando quieras volver a venderlo.",
    inventory: {
      title: "Inventario",
      available: "Disponibles",
      reserved: "Reservadas",
      delivered: "Entregadas",
      returned: "Devueltas",
    },
  },

  deposit: {
    title: "Cómo meter stock",
    join: "Entra en el servidor con tu cuenta de Minecraft.",
    command: "Escribe {command} y elige el producto (activo o pausado).",
    stack: "Mete pilas de exactamente {amount} × {item}. Cada pila es una unidad a la venta.",
    stackAny: "Mete pilas del objeto del producto con sus objetos por lote exactos. Cada pila es una unidad a la venta.",
    appears: "El stock aparece en el panel en cuanto el servidor lo guarda.",
    note: "Solo se acepta lo que coincide con el objeto y los objetos por lote del producto. Lo demás vuelve a tu inventario.",
    storage: "Cada unidad ocupa sitio en los almacenes de la zona de tu tienda. Mira cuánto queda con {command}.",
    notApproved: "Podrás depositar cuando un admin apruebe tu tienda.",
  },

  orders: {
    title: "Pedidos",
    caption: "Pedidos de tu tienda",
    filterLabel: "Filtrar por estado",
    filters: {
      all: { label: "Todos" },
      open: { label: "En curso" },
      PENDING: { label: "Pendientes" },
      PAID: { label: "Pagados" },
      READY: { label: "En taquilla" },
      COLLECTED: { label: "Recogidos" },
      FAILED: { label: "Fallidos o cancelados" },
      REFUNDED: { label: "Reembolsados" },
    },
    columns: {
      number: "Pedido",
      date: "Fecha",
      buyer: "Comprador",
      listing: "Producto",
      units: "Unidades",
      total: "Total",
      locker: "Entrega",
      status: "Estado",
    },
    mailbox: "Buzón (exprés)",
    items: { one: "{count} objeto", other: "{count} objetos" },
    count: { zero: "Sin pedidos", one: "{count} pedido", other: "{count} pedidos" },
    unknownBuyer: "Jugador desconocido",
    empty: {
      title: "No hay pedidos por aquí",
      body: "Cuando alguien compre en tu tienda, lo verás en esta lista.",
    },
    emptyFiltered: {
      title: "Nada con este estado",
      body: "Prueba con otro filtro.",
    },
    pagination: {
      newer: "Más recientes",
      older: "Más antiguos",
      page: "Página {page} de {pages}",
    },
  },

  errors: {
    nameLength: "El nombre debe tener entre 3 y 40 caracteres.",
    slugFormat: "El enlace debe tener entre 3 y 40 caracteres: minúsculas, números y guiones.",
    slugTaken: "Ese enlace lo usa o lo usó otra tienda. Prueba con otro.",
    descriptionLength: "La descripción no puede pasar de 500 caracteres.",
    inkInvalid: "Elige una de las tintas.",
    titleLength: "El título debe tener entre 3 y 60 caracteres.",
    materialFormat:
      "Escribe el id del objeto (minúsculas, números y guiones bajos, como diamond_pickaxe) o la clave de un objeto registrado.",
    itemUnknown:
      "Ese objeto de otro plugin no está registrado. Pide a un admin que lo registre en el juego con /cz item register.",
    unitAmountRange: "Los objetos por lote deben ser un número entero entre 1 y 64.",
    unitAmountStack:
      "Cada lote es una sola pila y este objeto admite como mucho {max} por pila. Baja los objetos por lote.",
    priceFormat: "Escribe el precio con hasta 2 decimales, por ejemplo 12,50.",
    priceRange: "El precio debe ser mayor que 0 y no pasar de 1.000.000.000.",
    statusInvalid: "Elige si el producto está activo o pausado.",
    taglineLength: "El lema no puede pasar de 80 caracteres.",
    featuredTooMany: "Puedes destacar como mucho 4 productos.",
    imageMissing: "Elige una imagen.",
    imageType: "La imagen debe ser PNG, JPG o WebP.",
    imageSize: "La imagen no puede pasar de 2 MB.",
    shopLimit: "Has alcanzado tu límite de tiendas.",
    shopNotFound: "Esa tienda no existe o no es tuya.",
    notRejected: "Esta solicitud ya no está rechazada. Recarga la página para ver cómo va.",
    suspended: "Esta tienda está suspendida: no puedes hacer cambios.",
    notFound: "Ese producto no existe o no es de esta tienda.",
    removed: "Este producto está retirado: recupéralo antes de cambiarlo.",
    generic: "No se ha podido guardar. Vuelve a intentarlo en un momento.",
    fixFields: "Revisa los campos marcados.",
  },
} as const;
