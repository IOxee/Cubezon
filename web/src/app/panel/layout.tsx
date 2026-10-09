import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * Seller panel: /panel lists the player's shops and /panel/[tienda] is the panel of one of them
 * (with its own side menu in [tienda]/layout.tsx). Private pages, kept out of search engines.
 */
export default function PanelLayout({ children }: LayoutProps<"/panel">) {
  return children;
}
