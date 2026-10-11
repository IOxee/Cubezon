/**
 * Spanish texts: help. Placeholders: {command} is rendered as an in-game command chip and
 * {signIn}, {lockers}, {orders}, {sell}, {panel} as links to those pages.
 */
export const help = {
  meta: {
    title: "Ayuda",
    description: "Cómo vincular tu cuenta, comprar, recoger en una taquilla y vender en Cubezon.",
  },
  title: "Cómo funciona Cubezon",
  lead: "Un mercado del servidor con reglas sencillas: las tiendas depositan objetos reales en el juego, tú pagas con dinero del juego y recoges en una taquilla.",
  tocLabel: "En esta página",
  stepLabel: "Paso {number}",

  links: {
    signIn: "Entrar",
    lockers: "la lista de taquillas",
    orders: "Mis pedidos",
    sell: "Vender en Cubezon",
    panel: "tu panel de tienda",
  },

  sections: {
    link: {
      label: "Cuenta",
      title: "Vincular tu cuenta",
      steps: [
        "Entra en el servidor de Minecraft.",
        "Escribe {command}. Te dará un código de 6 caracteres.",
        "Pon el código en {signIn} antes de que caduque (dura unos minutos y solo vale una vez).",
      ],
      note: "No hay contraseñas: tu cuenta de la web es tu cuenta del juego. Si el código caduca, pide otro.",
    },
    buy: {
      label: "Compra",
      title: "Comprar",
      steps: [
        "Busca lo que quieras o navega por las categorías.",
        "Elige cuántas unidades quieres y cómo te llega: en una taquilla o, si el servidor lo tiene activo, por envío exprés a tu buzón.",
        "Confirma en la caja. El pedido queda pendiente hasta que se cobra de tu saldo del juego (en modo roleplay, cuando la tienda lo acepta).",
      ],
      note: "Cada unidad es un lote: si un producto dice ×16, por cada unidad recibes 16 objetos. Sigue el estado en {orders}.",
    },
    pickup: {
      label: "Recogida",
      title: "Recoger un pedido",
      steps: [
        "Espera a que el pedido diga «En taquilla» en {orders}.",
        "Ve a la taquilla que elegiste. Tienes las coordenadas en {lockers}.",
        "Haz clic derecho en el bloque de la taquilla o usa {command} a 5 bloques o menos, y elige el pedido en el menú.",
      ],
      note: "Solo puedes recoger tus pedidos, y solo en la taquilla que elegiste al pagar. Lleva tantos huecos libres en el inventario como unidades tenga el pedido.",
    },
    sell: {
      label: "Venta",
      title: "Vender en Cubezon",
      steps: [
        "Solicita tu tienda en {sell}. Un admin la revisa antes de abrirla.",
        "Cuando esté aprobada, crea productos desde {panel}: título, objeto, objetos por unidad y precio.",
        "Deposita el stock en el juego. Sin stock depositado no se vende nada.",
      ],
      note: "Cobras en dinero del juego cuando el servidor procesa cada pedido (en modo roleplay, cuando el paquete llega a la taquilla).",
    },
    deposit: {
      label: "Stock",
      title: "Depositar stock",
      steps: [
        "En el juego, escribe {command} y elige el producto.",
        "Mete los objetos en el menú. Deben ser del objeto del producto y en montones del tamaño exacto de la unidad (16 si el producto es ×16).",
        "Cada montón aceptado es una unidad a la venta. Encantamientos, nombres y demás se conservan tal cual.",
      ],
      note: "Lo que no encaja no se acepta y vuelve a tu inventario.",
    },
  },

  /** Roleplay order mode: how it works and the computer and employee commands. */
  roleplay: {
    label: "Modo roleplay",
    title: "Pedidos en modo roleplay",
    lead: "El servidor funciona en uno de dos modos. En el automático, el servidor cobra y prepara cada pedido solo. En el roleplay, cada tienda atiende sus pedidos a mano desde su «Ordenador de empresa», dentro de su zona en el juego.",
    current: "Modo actual",
    steps: [
      "Compras como siempre. El pedido queda «Esperando a la tienda» y todavía no se te cobra nada.",
      "La tienda lo acepta o lo rechaza desde su ordenador. Al aceptarlo se te cobra y el dinero queda retenido; si lo rechaza, no pagas nada.",
      "La tienda imprime un paquete y alguien lo lleva a tu taquilla. Al entregarlo, el pedido pasa a «Listo para recoger» y la tienda cobra.",
      "Lo recoges como siempre. Si la tienda no lo acepta o no lo entrega a tiempo, se anula: sin cobro o con el dinero devuelto.",
    ],
    commandsTitle: "Comandos para tiendas",
    commands: [
      { key: "computerBuy", text: "Compra ordenadores de empresa. Colócalos dentro de la zona de tu tienda." },
      { key: "employeeAdd", text: "Deja que otro jugador use el ordenador de tu tienda." },
      { key: "employeeRemove", text: "Le quita el acceso." },
      { key: "employeeList", text: "Lista los empleados de la tienda." },
      { key: "computerGive", text: "Solo admins: da ordenadores a un jugador." },
    ],
    note: "<tienda> es el enlace de tu tienda (lo que va después de /t/). Los empleados solo los gestiona el dueño o un admin; también desde {panel}.",
  },

  faq: {
    label: "Preguntas frecuentes",
    title: "Lo que todo el mundo pregunta",
    items: [
      {
        q: "¿Se paga con dinero real?",
        a: "No. Todo se paga con el dinero del juego del servidor. Aquí nadie te pedirá euros, tarjetas ni nada parecido.",
      },
      {
        q: "¿Qué pasa si no tengo saldo suficiente?",
        a: "El pedido falla sin coste: el servidor no te cobra nada y el pedido queda como «Fallido». Consigue saldo y vuelve a pedirlo.",
      },
      {
        q: "¿Y si se agota mientras compro?",
        a: "Solo se vende lo que está depositado. Si no queda stock cuando el servidor procesa tu pedido, falla sin cobrarte nada.",
      },
      {
        q: "¿Cuándo se me cobra?",
        a: "Cuando el servidor procesa el pedido o, en modo roleplay, cuando la tienda lo acepta; nunca al darle a comprar. Si algo sale mal a mitad, el pedido se marca como fallido o se reembolsa entero.",
      },
      {
        q: "¿Y si la tienda no atiende mi pedido?",
        a: "En modo roleplay, si la tienda no lo acepta a tiempo, se anula sin cobrarte nada. Si lo acepta pero no lo lleva a la taquilla a tiempo, se te devuelve el dinero.",
      },
      {
        q: "¿Puedo recibirlo sin ir a una taquilla?",
        a: "Si el servidor tiene activo el envío exprés, sí. Coloca tu buzón en el juego (lo consigues con /cz mailbox buy) y elige «Envío exprés a tu buzón» en la caja. Cuesta una tarifa extra, una vez por compra, y el pedido llega solo a tu buzón. Recógelo con clic derecho en él; /cz mailbox te dice dónde está.",
      },
      {
        q: "¿Quién puede vender?",
        a: "Cualquier jugador con su cuenta vinculada puede solicitar una tienda. Vende cuando un admin la aprueba.",
      },
      {
        q: "¿Puedo valorar lo que compro?",
        a: "Sí, una vez recogido el pedido. Por eso todas las valoraciones son de compras reales.",
      },
    ],
  },

  contact: {
    title: "¿Sigue sin cuadrar algo?",
    body: "Pregunta a un admin dentro del servidor. Ten a mano el número de pedido.",
  },
} as const;
