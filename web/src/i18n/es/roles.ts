/**
 * Spanish texts: ranks of a shop (shop_roles) and their permissions. The permission names are the
 * same ones the game shows: keep them in sync with the plugin.
 */
export const roles = {
  nav: "Rangos",
  metaTitle: "Rangos de tu tienda",
  title: "Rangos",
  intro:
    "Cada empleado tiene un rango, y el rango decide qué puede hacer en el ordenador de la tienda y en este panel. Tú, como dueño, lo puedes todo y eres el único que crea, cambia y borra rangos.",
  staffNote:
    "Quien tenga «Gestionar personal» puede contratar, despedir y cambiar rangos, pero no puede dar ese permiso ni tocar a quien ya lo tenga.",
  limitNote: { one: "Puedes tener {count} rango como mucho.", other: "Puedes tener hasta {count} rangos." },
  suspended: "Esta tienda está suspendida: no puedes cambiar los rangos.",

  /** Same names as in the game. */
  permissions: {
    "orders.decide": "Aceptar y rechazar pedidos",
    "orders.package": "Imprimir paquetes",
    "stock.deposit": "Depositar stock",
    "stock.withdraw": "Retirar stock",
    "products.manage": "Gestionar productos",
    "staff.manage": "Gestionar personal",
    "storage.buy": "Comprar almacenes",
  },
  permissionHints: {
    "orders.decide": "Decide los pedidos en el ordenador. Al aceptar se cobra al comprador.",
    "orders.package": "Imprime el paquete de un pedido aceptado para llevarlo a la taquilla.",
    "stock.deposit": "Mete objetos en los productos de la tienda.",
    "stock.withdraw": "Saca stock sin vender y se lo queda en el inventario.",
    "products.manage": "Crea, edita, pausa y retira productos, y fija sus muestras.",
    "staff.manage": "Contrata, despide y cambia el rango de los empleados.",
    "storage.buy": "Compra almacenes y ordenadores para la tienda.",
  },
  permissionsLegend: "Permisos",
  noPermissions: "Sin permisos",
  allPermissions: "Todos los permisos",
  caption: "Rangos de la tienda",
  columns: { name: "Rango", permissions: "Permisos", members: "Empleados", actions: "Acciones" },
  edit: "Editar",
  editTitle: "Editar «{name}»",
  default: "Por defecto",
  defaultHint: "Es el rango que reciben los nuevos empleados. Para borrarlo, elige antes otro por defecto.",
  members: { zero: "Nadie lo tiene", one: "{count} empleado", other: "{count} empleados" },

  form: {
    name: "Nombre",
    namePlaceholder: "Repartidor",
    save: "Guardar",
    saving: "Guardando…",
    saved: "Rango guardado.",
    create: "Crear rango",
    creating: "Creando…",
    created: "Rango «{name}» creado.",
  },
  newTitle: "Nuevo rango",
  limitReached: "Ya tienes el máximo de rangos. Borra uno para crear otro.",
  makeDefault: "Hacer por defecto",
  makingDefault: "Cambiando…",
  remove: "Borrar",
  confirmRemove: "¿Borrar el rango «{name}»? Sus empleados pasan a «{fallback}».",

  errors: {
    nameRequired: "Ponle un nombre.",
    nameLength: "El nombre puede tener hasta 24 caracteres.",
    exists: "Ya hay un rango con ese nombre.",
    limit: "Ya tienes el máximo de rangos ({max}).",
    notFound: "Ese rango ya no existe. Recarga la página.",
    suspended: "Esta tienda está suspendida: no puedes cambiar los rangos.",
    generic: "No se ha podido guardar. Vuelve a intentarlo en un momento.",
  },
} as const;
