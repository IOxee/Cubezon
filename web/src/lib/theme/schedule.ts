import { TIME_ZONE } from "@/lib/format";

/**
 * Theme schedules are typed as wall-clock time in the community's time zone (Europe/Madrid)
 * with <input type="datetime-local"> ("YYYY-MM-DDTHH:mm") and stored as UTC ISO strings.
 * Both directions use the same zone on server and client, so forms render identically.
 */

const LOCAL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

const parts = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function zoneFields(date: Date): Record<string, number> {
  return Object.fromEntries(
    parts
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
}

/** "2026-10-31T00:00" (Madrid) -> "2026-10-30T23:00:00.000Z"; null if malformed. */
export function zoneLocalToIso(local: string): string | null {
  const match = LOCAL.exec(local.trim());
  if (!match) return null;
  const [y, mo, d, h, mi] = match.slice(1).map(Number);
  const wanted = Date.UTC(y, mo - 1, d, h, mi);
  // Guess the instant, then correct it by the zone offset at that instant (twice for DST edges).
  let instant = wanted;
  for (let i = 0; i < 2; i++) {
    const f = zoneFields(new Date(instant));
    const shown = Date.UTC(f.year, f.month - 1, f.day, f.hour, f.minute);
    instant += wanted - shown;
  }
  return new Date(instant).toISOString();
}

/** UTC ISO -> "YYYY-MM-DDTHH:mm" in Madrid, for datetime-local inputs. */
export function isoToZoneLocal(iso: string): string {
  const f = zoneFields(new Date(iso));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${f.year}-${pad(f.month)}-${pad(f.day)}T${pad(f.hour)}:${pad(f.minute)}`;
}

export type SchedulePhase = "upcoming" | "running" | "ended";

export function schedulePhase(startsAt: string, endsAt: string, now: number): SchedulePhase {
  if (now < Date.parse(startsAt)) return "upcoming";
  if (now < Date.parse(endsAt)) return "running";
  return "ended";
}
