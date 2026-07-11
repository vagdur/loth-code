import { describe, expect, test } from "vitest";
import { utcDate } from "../../src/calendar/computus.js";
import {
  applyMemoriaPolicy,
  buildSaintCandidate,
  buildSeasonalFrame,
  compareObservances,
  isAdvent17Through24,
  isChristmasOctaveFerial,
  isLentenFerial,
  resolveCelebrationFromParts,
} from "../../src/calendar/celebrationRanking.js";
import type { CalendarSaint } from "../../src/types/sanctoralCalendar.js";
function mockSaint(
  id: string,
  rank: CalendarSaint["rank"],
  observanceOf?: "lord" | "saint",
): CalendarSaint {
  const nominal = utcDate(2026, 1, 1);
  return {
    saintId: id,
    rank,
    applicableCommons: ["holy_men_women"],
    ...(observanceOf !== undefined ? { observanceOf } : {}),
    nominalDate: () => nominal,
    celebrationDate: () => nominal,
  };
}

describe("celebrationRanking date helpers", () => {
  test("isAdvent17Through24", () => {
    expect(isAdvent17Through24(utcDate(2026, 12, 17))).toBe(true);
    expect(isAdvent17Through24(utcDate(2026, 12, 16))).toBe(false);
  });

  test("isChristmasOctaveFerial excludes Dec 25 and Jan 1", () => {
    expect(isChristmasOctaveFerial(utcDate(2026, 12, 26), "christmas")).toBe(true);
    expect(isChristmasOctaveFerial(utcDate(2026, 12, 31), "christmas")).toBe(true);
    expect(isChristmasOctaveFerial(utcDate(2026, 12, 25), "christmas")).toBe(false);
    expect(isChristmasOctaveFerial(utcDate(2027, 1, 1), "christmas")).toBe(false);
    // Past the octave but still the Christmas season → not an octave ferial.
    expect(isChristmasOctaveFerial(utcDate(2027, 1, 2), "christmas")).toBe(false);
  });

  test("isLentenFerial excludes Ash Wednesday", () => {
    expect(isLentenFerial(utcDate(2026, 3, 7), "lent", "lent_w1_sat")).toBe(true);
    expect(isLentenFerial(utcDate(2026, 2, 18), "lent", "ash_wednesday")).toBe(false);
  });
});

describe("compareObservances", () => {
  test("solemnity beats feast", () => {
    const sol = buildSaintCandidate(mockSaint("a", "solemnity"), {
      date: utcDate(2026, 7, 15),
      season: "ordinary_time",
      weekday: "Wednesday",
      seasonalKey: null,
    });
    const feast = buildSaintCandidate(mockSaint("b", "feast"), {
      date: utcDate(2026, 7, 15),
      season: "ordinary_time",
      weekday: "Wednesday",
      seasonalKey: null,
    });
    expect(compareObservances(sol, feast)).toBeLessThan(0);
  });

  test("feast loses to Sunday frame", () => {
    const feast = buildSaintCandidate(mockSaint("b", "feast"), {
      date: utcDate(2026, 10, 4),
      season: "ordinary_time",
      weekday: "Sunday",
      seasonalKey: null,
    });
    const frame = buildSeasonalFrame({
      date: utcDate(2026, 10, 4),
      season: "ordinary_time",
      weekday: "Sunday",
      seasonalKey: "ot_w27_sun",
    });
    expect(compareObservances(feast, frame)).toBeGreaterThan(0);
  });
});

describe("applyMemoriaPolicy", () => {
  test("§237 full suppression on Sunday frame", () => {
    const frame = buildSeasonalFrame({
      date: utcDate(2026, 10, 4),
      season: "ordinary_time",
      weekday: "Sunday",
      seasonalKey: "ot_w27_sun",
    });
    const flags = applyMemoriaPolicy(
      frame,
      mockSaint("francis_of_assisi", "obligatory_memoria"),
      {
        date: utcDate(2026, 10, 4),
        season: "ordinary_time",
        weekday: "Sunday",
        seasonalKey: "ot_w27_sun",
      },
    );
    expect(flags.memoriaFullySuppressed).toBe(true);
    expect(flags.saintId).toBeUndefined();
  });

  test("§238 partial suppression on Lent ferial", () => {
    const frame = buildSeasonalFrame({
      date: utcDate(2026, 3, 6),
      season: "lent",
      weekday: "Friday",
      seasonalKey: "lent_w1_fri",
    });
    const flags = applyMemoriaPolicy(
      frame,
      mockSaint("st_henrik", "obligatory_memoria"),
      {
        date: utcDate(2026, 3, 6),
        season: "lent",
        weekday: "Friday",
        seasonalKey: "lent_w1_fri",
      },
    );
    expect(flags.memoriaReducedToOptional).toBe(true);
    expect(flags.allowMemoriaAddendum).toBe(true);
    expect(flags.saintId).toBe("st_henrik");
  });
});

describe("resolveCelebrationFromParts", () => {
  test("obligatory memoria wins on ordinary weekday", () => {
    const c = resolveCelebrationFromParts(
      utcDate(2024, 10, 4),
      "ordinary_time",
      "ot_w27_fri",
      [mockSaint("francis_of_assisi", "obligatory_memoria")],
    );
    expect(c.type).toBe("obligatory_memoria");
    expect(c.source).toBe("saint");
    expect(c.saintId).toBe("francis_of_assisi");
    expect(c.seasonalKey).toBe("ot_w27_fri");
  });

  test("feast of the Lord on OT Sunday", () => {
    const c = resolveCelebrationFromParts(
      utcDate(2026, 8, 6),
      "ordinary_time",
      "ot_w19_thu",
      [mockSaint("transfiguration", "feast", "lord")],
    );
    // Aug 6 2026 is Thursday — use a Sunday for this test
    const sunday = utcDate(2026, 8, 9);
    const cSun = resolveCelebrationFromParts(
      sunday,
      "ordinary_time",
      "ot_w19_sun",
      [mockSaint("transfiguration", "feast", "lord")],
    );
    expect(cSun.type).toBe("feast_of_lord_on_sunday");
    expect(c.type).toBe("feast");
  });

  test("weekday seasonal solemnity Ascension", () => {
    const c = resolveCelebrationFromParts(
      utcDate(2026, 5, 14),
      "eastertide",
      "ascension",
      [],
    );
    expect(c.type).toBe("solemnity");
    expect(c.source).toBe("seasonal");
    expect(c.seasonalKey).toBe("ascension");
  });

  test("seasonal solemnity transferred to Sunday is celebrated as solemnity", () => {
    const c = resolveCelebrationFromParts(
      utcDate(2026, 6, 7),
      "ordinary_time",
      "corpus_christi",
      [],
    );
    expect(c.type).toBe("solemnity");
    expect(c.source).toBe("seasonal");
    expect(c.seasonalKey).toBe("corpus_christi");
  });

  test("transferred saint solemnity wins on Sunday", () => {
    const nominal = utcDate(2026, 3, 25);
    const transferred = utcDate(2026, 4, 12);
    const saint: CalendarSaint = {
      saintId: "annunciation",
      rank: "solemnity",
      applicableCommons: ["bvm"],
      nominalDate: () => nominal,
      celebrationDate: () => transferred,
    };
    const c = resolveCelebrationFromParts(
      transferred,
      "eastertide",
      "easter_w3_sun",
      [saint],
    );
    expect(c.type).toBe("solemnity");
    expect(c.source).toBe("saint");
    expect(c.saintId).toBe("annunciation");
  });
});
