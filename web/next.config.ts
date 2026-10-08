import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // "Anuncios" are called "productos" now (same as in the game): keep the old panel links working.
  async redirects() {
    return [
      { source: "/panel/:tienda/anuncios", destination: "/panel/:tienda/productos", permanent: true },
      { source: "/panel/:tienda/anuncios/:path*", destination: "/panel/:tienda/productos/:path*", permanent: true },
    ];
  },
  experimental: {
    serverActions: {
      // Shop logos and banners (the storage bucket allows up to 2 MB per image).
      bodySizeLimit: "3mb",
    },
  },
};

export default nextConfig;
