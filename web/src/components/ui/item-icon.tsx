"use client";

import { useState } from "react";
import { itemIconUrl } from "@/lib/items/icons";

/** Original game icon for a material, rendered crisp. Shows a "?" box if the image fails. */
export function ItemIcon({ material, size = 48, alt = "" }: { material: string; size?: number; alt?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <span
        role={alt ? "img" : undefined}
        aria-label={alt || undefined}
        className="inline-flex items-center justify-center border-2 border-dashed border-ink-3 font-pixel text-ink-3"
        style={{ width: size, height: size, fontSize: size / 2 }}
      >
        ?
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- tiny pixel art from an external CDN
    <img
      src={itemIconUrl(material)}
      alt={alt}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      className="pixelated inline-block"
      onError={() => setFailed(true)}
    />
  );
}
