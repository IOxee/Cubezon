/**
 * Spanish texts: roleplay order mode (shops accept and deliver orders by hand in the game).
 * The plugin publishes the mode in plugin_settings.orders_mode; in automatic mode the texts of
 * m.status are used as before. The deadlines are plugin config: never show exact hours here.
 */
export const roleplay = {
  /** Name of each order mode (admin overview, help). */
  modes: {
    automatic: "Automático",
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
      PENDING: "Esperando a la tienda",
      PAID: "Aceptado, en preparación",
    },
    stamp: {
      PENDING: "Por aceptar",
      PAID: "En preparación",
    },
    help: {
      PENDING:
        "La tienda tiene que aceptar tu pedido desde su ordenador en el juego. No se te cobra nada hasta entonces y, si no lo atiende a tiempo, se anula sin coste.",
      PAID:
        "La tienda aceptó el pedido y ya se te ha cobrado. Ahora lo prepara y alguien de la tienda lo llevará a tu taquilla; puede tardar unas horas. Si no llega a tiempo, se te devuelve el dinero.",
    },
    processingHelp: "La tienda acaba de aceptar tu pedido y el servidor te lo está cobrando ahora mismo.",
    /** Tracking steps of the order page. */
    steps: {
      PAID: "Aceptado y cobrado",
      READY: "Entregado en la taquilla",
    },
    receiptPending: "Sin cobrar: la tienda aún no lo ha aceptado",
  },

  /** New orders.failure_reason codes of the roleplay mode. */
  failureReason: {
    SHOP_REJECTED: "La tienda canceló el pedido.",
    EXPIRED: "La tienda no atendió el pedido a tiempo, así que se canceló solo.",
    DELIVERY_EXPIRED:
      "La tienda aceptó el pedido, pero no lo entregó en la taquilla a tiempo. Se te ha devuelto el dinero.",
  },

  checkout: {
    noticeTitle: "Cada tienda atiende sus pedidos a mano",
    notice:
      "La tienda tiene que aceptar tu pedido desde el juego. Se te cobra cuando lo acepta, no ahora. Si no lo atiende a tiempo, se anula sin coste.",
    payment:
      "Al confirmar no se cobra nada todavía: el servidor cobrará {total} de tu saldo en el juego cuando la tienda acepte el pedido. Si no te llega, el pedido falla sin coste.",
    paymentExpress:
      "Al confirmar no se cobra nada todavía: el servidor cobrará {total} más {fee} del envío exprés de tu saldo en el juego cuando la tienda acepte el pedido. Si no te llega, el pedido falla sin coste.",
  },

  orders: {
    created: {
      one: "Pedido confirmado. Ahora la tienda tiene que aceptarlo; se te cobrará en ese momento.",
      other: "{count} pedidos confirmados. Cada tienda tiene que aceptar el suyo; se te cobrará en ese momento.",
    },
  },

  /** Seller panel of one shop (/panel/<slug>). */
  panel: {
    nav: "Empleados",
    filters: {
      PENDING: "Por aceptar",
      PAID: "En preparación",
    },
    ordersHint:
      "Modo roleplay: aceptas o rechazas los pedidos desde el ordenador de empresa de la tienda, en el juego. Al aceptar se cobra al comprador y el dinero queda retenido; lo recibes cuando el paquete llega a la taquilla.",
    /** «Cobrado» column of the orders table (orders.seller_paid_at). */
    payout: {
      column: "Cobrado",
      pending: "Pendiente",
      pendingDelivery: "Al entregar",
      none: "—",
    },
    computer: {
      title: "Ordenador de empresa",
      count: {
        zero: "Ningún ordenador en la zona",
        one: "{count} ordenador en la zona",
        other: "{count} ordenadores en la zona",
      },
      missingTitle: "Tu tienda no tiene ordenador de empresa",
      missing:
        "Sin ordenador no puedes aceptar pedidos, así que caducan sin cobrarse. Cómpralo con {command} y colócalo dentro de la zona de tu tienda.",
      missingNoZone:
        "Además, tu tienda aún no tiene zona: pide a un admin que la marque en el juego para poder colocarlo.",
      buy: "Cómpralo con {command} y colócalo dentro de la zona de tu tienda.",
      ok: "Desde él aceptas o rechazas los pedidos e imprimes los paquetes para la taquilla.",
      employees: {
        zero: "Solo tú puedes usarlo.",
        one: "Lo puedes usar tú y {count} empleado.",
        other: "Lo puedes usar tú y {count} empleados.",
      },
      manageEmployees: "Gestionar empleados",
    },
  },

  /** Employees page of one shop (/panel/<slug>/empleados). */
  employees: {
    metaTitle: "Empleados de tu tienda",
    title: "Empleados",
    intro:
      "Los empleados usan el ordenador de empresa de la tienda según su rango: aceptar o rechazar pedidos, imprimir paquetes, depositar stock… El dueño siempre lo puede todo.",
    readOnly: "Tu rango no permite gestionar el personal: aquí solo puedes ver quién trabaja en la tienda.",
    noAssignableRoles: "Todos los rangos de la tienda incluyen «Gestionar personal», así que solo el dueño puede contratar.",
    automaticNote:
      "Ahora el servidor procesa los pedidos solo (modo automático), así que de momento los empleados no tienen nada que hacer. Les servirá si el servidor pasa a modo roleplay.",
    caption: "Empleados de la tienda",
    columns: {
      player: "Jugador",
      role: "Rango",
      since: "Desde",
      addedBy: "Añadido por",
      actions: "Acciones",
    },
    unknownPlayer: "Jugador desconocido",
    count: { zero: "Sin empleados", one: "{count} empleado", other: "{count} empleados" },
    empty: {
      title: "Aquí trabajas tú solo",
      body: "Añade a quien te eche una mano con los pedidos. Tiene que haber entrado al servidor al menos una vez.",
    },
    remove: "Quitar",
    removing: "Quitando…",
    owner: "Dueño",
    you: "(tú)",
    noRole: "Sin rango",
    changeRole: "Cambiar",
    changingRole: "Cambiando…",
    roleLabel: "Rango de {name}",
    add: {
      title: "Añadir empleado",
      label: "Nombre en Minecraft",
      hint: "Tal cual lo ves en el juego. Tiene que haber entrado al servidor al menos una vez.",
      placeholder: "Steve",
      role: "Rango",
      roleHint: "Lo que podrá hacer en la tienda. Luego se lo puedes cambiar.",
      submit: "Añadir",
      submitting: "Añadiendo…",
      added: "{name} ya es empleado de la tienda.",
    },
    limitNote: {
      zero: "Ahora mismo el servidor no deja trabajar en tiendas ajenas.",
      one: "Cada jugador puede trabajar como empleado en {count} tienda ajena como mucho.",
      other: "Cada jugador puede trabajar como empleado en {count} tiendas ajenas como mucho.",
    },
    game: "También desde el juego:",
    suspended: "Esta tienda está suspendida: no puedes añadir empleados.",
    errors: {
      format: "Escribe el nombre tal cual sale en el juego: hasta 16 letras, números o guiones bajos, sin espacios.",
      notFound:
        "No hay ningún jugador llamado «{name}». Tiene que entrar al servidor al menos una vez antes de que puedas añadirlo.",
      owner: "Eres el dueño de la tienda: ya puedes usar el ordenador sin ser empleado.",
      exists: "{name} ya es empleado de la tienda.",
      limit: "{name} ya trabaja en el máximo de tiendas permitido ({max}). Tiene que dejar otra antes.",
      role: "Elige uno de los rangos de la tienda.",
      roleForbidden: "Solo el dueño puede dar un rango con «Gestionar personal».",
      suspended: "Esta tienda está suspendida: no puedes añadir empleados.",
      generic: "No se ha podido guardar. Vuelve a intentarlo en un momento.",
    },
  },

  admin: {
    modeTitle: "Modo de pedidos",
    modeHint: {
      automatic: "El plugin cobra y prepara los pedidos solo.",
      roleplay: "Cada tienda acepta y entrega sus pedidos desde el juego.",
    },
    modeChange: "Se cambia en la config del plugin (orders.mode) y hace falta reiniciar el servidor.",
    stuckHint:
      "En modo roleplay los pedidos esperan a que cada tienda los acepte, así que es normal que haya pendientes un buen rato. Caducan solos si nadie los atiende.",
  },
} as const;
