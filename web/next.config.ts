import type { NextConfig } from "next";

/** Old Spanish URL -> English one. Every route moved to English; old links keep working. */
const LEGACY_PATHS: [from: string, to: string][] = [
  ["/admin/equipo", "/admin/team"],
  ["/admin/fotos", "/admin/photos"],
  ["/admin/funciones", "/admin/features"],
  ["/admin/jugadores", "/admin/players"],
  ["/admin/pedidos", "/admin/orders"],
  ["/admin/taquillas", "/admin/lockers"],
  ["/admin/temas/nuevo", "/admin/themes/new"],
  ["/admin/temas", "/admin/themes"],
  ["/admin/tiendas", "/admin/shops"],
  ["/ayuda", "/help"],
  ["/buscar", "/search"],
  ["/caja", "/checkout"],
  ["/carrito", "/cart"],
  ["/cuenta", "/account"],
  ["/entrar", "/login"],
  ["/pedidos", "/orders"],
  ["/taquillas", "/lockers"],
  ["/tiendas", "/shops"],
  ["/vender", "/sell"],
  // "Anuncios" were renamed "productos" before the routes moved to English.
  ["/panel/:shop/anuncios/nuevo", "/panel/:shop/products/new"],
  ["/panel/:shop/anuncios", "/panel/:shop/products"],
  ["/panel/:shop/productos/nuevo", "/panel/:shop/products/new"],
  ["/panel/:shop/productos", "/panel/:shop/products"],
  ["/panel/:shop/empleados", "/panel/:shop/staff"],
  ["/panel/:shop/pedidos", "/panel/:shop/orders"],
  ["/panel/:shop/rangos", "/panel/:shop/ranks"],
  ["/panel/:shop/tienda", "/panel/:shop/shop"],
];

/**
 * Security headers for every response. No script-src CSP: it would need a per-request nonce,
 * which turns every page dynamic and defeats the prerendered shell (Cache Components). React
 * escaping, the validated theme CSS and image uploads restricted to PNG/JPEG/WebP cover XSS.
 */
const SECURITY_HEADERS = [
  // Nobody may frame the site (clickjacking on the seller panel and admin forms).
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

const nextConfig: NextConfig = {
  // Self-contained server (.next/standalone/server.js) for the release zip; hosts like Vercel ignore it.
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  async redirects() {
    // ":path*" also matches nothing, so each entry covers the page itself and everything below it.
    return LEGACY_PATHS.map(([from, to]) => ({
      source: `${from}/:path*`,
      destination: `${to}/:path*`,
      permanent: true,
    }));
  },
  experimental: {
    serverActions: {
      // Shop logos and banners (the storage bucket allows up to 2 MB per image).
      bodySizeLimit: "3mb",
    },
  },
};

export default nextConfig;
