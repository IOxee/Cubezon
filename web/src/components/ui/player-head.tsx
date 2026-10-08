"use client";

import { useState } from "react";
import { playerHeadUrl } from "@/lib/player-head";
import { ItemIcon } from "./item-icon";

/** The player's own skin face; the generic player head if the skin service fails. */
export function PlayerHead({ uuid, size = 56, alt }: { uuid: string; size?: number; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <ItemIcon material="player_head" size={size} alt={alt} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- pixel art from an external skin service
    <img
      src={playerHeadUrl(uuid, size)}
      alt={alt}
      width={size}
      height={size}
      decoding="async"
      className="pixelated inline-block"
      onError={() => setFailed(true)}
    />
  );
}
