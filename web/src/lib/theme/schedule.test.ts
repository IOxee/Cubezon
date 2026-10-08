import { describe, expect, it } from "vitest";
import { isoToZoneLocal, schedulePhase, zoneLocalToIso } from "./schedule";

describe("zone conversions (Europe/Madrid)", () => {
  it("converts summer and winter wall-clock times to UTC", () => {
    expect(zoneLocalToIso("2026-07-01T12:00")).toBe("2026-07-01T10:00:00.000Z");
    expect(zoneLocalToIso("2026-12-24T20:30")).toBe("2026-12-24T19:30:00.000Z");
  });

  it("round-trips through datetime-local values", () => {
    for (const local of ["2026-10-31T00:00", "2026-03-29T04:15", "2027-01-01T00:00"]) {
      expect(isoToZoneLocal(zoneLocalToIso(local)!)).toBe(local);
    }
  });

  it("rejects malformed input", () => {
    expect(zoneLocalToIso("31/10/2026 00:00")).toBeNull();
    expect(zoneLocalToIso("")).toBeNull();
  });
});

describe("schedulePhase", () => {
  const start = "2026-10-30T00:00:00.000Z";
  const end = "2026-11-02T00:00:00.000Z";
  it("tells upcoming, running and ended apart", () => {
    expect(schedulePhase(start, end, Date.parse("2026-10-29T00:00:00Z"))).toBe("upcoming");
    expect(schedulePhase(start, end, Date.parse("2026-10-31T00:00:00Z"))).toBe("running");
    expect(schedulePhase(start, end, Date.parse("2026-11-02T00:00:00Z"))).toBe("ended");
  });
});
