import type { Metadata, Viewport } from "next";
import { Archivo, IBM_Plex_Mono, Pixelify_Sans } from "next/font/google";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { THEME_SCRIPT } from "@/components/theme/theme-preference";
import { ThemeStyle } from "@/components/theme/theme-style";
import { m } from "@/i18n";
import "./globals.css";

const archivo = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-archivo", display: "swap" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "600"], variable: "--font-plex-mono", display: "swap" });
const pixelify = Pixelify_Sans({ subsets: ["latin"], variable: "--font-pixelify", display: "swap" });

export const metadata: Metadata = {
  title: { default: `${m.meta.siteName} · ${m.meta.tagline}`, template: m.meta.titleTemplate },
  description: m.meta.description,
  applicationName: m.meta.siteName,
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ece5d3" },
    { media: "(prefers-color-scheme: dark)", color: "#161915" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: the theme script (and browser extensions) set attributes on <html>
    // before React hydrates.
    <html lang="es" suppressHydrationWarning className={`${archivo.variable} ${plexMono.variable} ${pixelify.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <ThemeStyle />
      </head>
      <body id="top" className="flex min-h-dvh flex-col">
        <a href="#content" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 btn btn-ink">
          {m.a11y.skipToContent}
        </a>
        <SiteHeader />
        <main id="content" className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
