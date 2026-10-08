/** Small pixel-art UI icons (10x10, currentColor). "#" = filled pixel. */
const ICONS = {
  sun: [
    "....##....",
    ".#......#.",
    "...####...",
    "..######..",
    "#.######.#",
    "#.######.#",
    "..######..",
    "...####...",
    ".#......#.",
    "....##....",
  ],
  moon: [
    "....###...",
    "..###.....",
    ".###......",
    ".##.......",
    ".##.......",
    ".##.......",
    ".###......",
    "..####..#.",
    "...######.",
    "....####..",
  ],
  monitor: [
    "##########",
    "#........#",
    "#........#",
    "#........#",
    "#........#",
    "##########",
    "....##....",
    "....##....",
    "..######..",
    "..........",
  ],
} as const;

export type PixelIconName = keyof typeof ICONS;

function pathOf(rows: readonly string[]): string {
  let d = "";
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (row[x] === "#") d += `M${x} ${y}h1v1h-1z`;
    }
  });
  return d;
}

const PATHS = Object.fromEntries(Object.entries(ICONS).map(([name, rows]) => [name, pathOf(rows)])) as Record<
  PixelIconName,
  string
>;

export function PixelIcon({ name, size = 16 }: { name: PixelIconName; size?: number }) {
  return (
    <svg viewBox="0 0 10 10" width={size} height={size} aria-hidden="true" shapeRendering="crispEdges" className="shrink-0">
      <path d={PATHS[name]} fill="currentColor" />
    </svg>
  );
}
