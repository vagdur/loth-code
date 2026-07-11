/**
 * office-spec §4–§5 (seasons), §10 (psalter week anchors), §12 (reading year),
 * §20 steps 1–2 — liturgical year boundaries and keys used for proper lookup.
 */

import { describe, expect, test } from "vitest";
import {
  addDays,
  ashWednesday,
  baptismOfTheLord,
  easterSunday,
  firstSundayOfAdvent,
  holyThursday,
  palmSunday,
  pentecost,
  utcDate,
} from "../../src/calendar/computus.js";
import {
  getOrdinaryTimeWeek,
  getPsalterWeek,
  getReadingYear,
  getSeason,
  getSeasonalDayKey,
  getSundayUnderYearNumber,
  getWeekday,
} from "../../src/calendar/liturgicalYear.js";

const Y = 2026;
const easter = easterSunday(Y);

describe("getSeason", () => {
  test("office-spec §4 — Advent on and after First Sunday of Advent", () => {
    const advent = firstSundayOfAdvent(Y - 1); // LY beginning Nov/Dec 2025
    expect(getSeason(addDays(advent, -1))).not.toBe("advent");
    expect(getSeason(advent)).toBe("advent");
    expect(getSeason(utcDate(Y - 1, 12, 24))).toBe("advent");
  });

  test("Christmas from Dec 25 through day before OT I Monday", () => {
    expect(getSeason(utcDate(Y - 1, 12, 25))).toBe("christmas");
    const bap = baptismOfTheLord(Y);
    const otIMonday = addDays(bap, 1);
    expect(getSeason(addDays(otIMonday, -1))).toBe("christmas");
  });

  test("Ordinary Time I from OT I Monday through day before Ash Wednesday", () => {
    const otIStart = addDays(baptismOfTheLord(Y), 1);
    const ash = ashWednesday(Y);
    expect(getSeason(otIStart)).toBe("ordinary_time");
    expect(getSeason(addDays(ash, -1))).toBe("ordinary_time");
  });

  test("Lent from Ash Wednesday through day before Palm Sunday", () => {
    const ash = ashWednesday(Y);
    const palm = palmSunday(Y);
    expect(getSeason(ash)).toBe("lent");
    expect(getSeason(addDays(palm, -1))).toBe("lent");
  });

  test("Holy Week from Palm Sunday through day before Holy Thursday", () => {
    const palm = palmSunday(Y);
    const thu = holyThursday(Y);
    expect(getSeason(palm)).toBe("holy_week");
    expect(getSeason(addDays(thu, -1))).toBe("holy_week");
  });

  test("Easter Triduum from Holy Thursday through Easter Sunday inclusive", () => {
    const thu = holyThursday(Y);
    expect(getSeason(thu)).toBe("easter_triduum");
    expect(getSeason(easter)).toBe("easter_triduum");
  });

  test("Eastertide from Monday after Easter through Pentecost Sunday", () => {
    expect(getSeason(addDays(easter, 1))).toBe("eastertide");
    expect(getSeason(pentecost(Y))).toBe("eastertide");
  });

  test("Ordinary Time II from Monday after Pentecost", () => {
    const otII = addDays(pentecost(Y), 1);
    expect(getSeason(otII)).toBe("ordinary_time");
  });
});

describe("getPsalterWeek", () => {
  // office-spec §10 — Week I begins on First Sunday of Advent, First OT Sunday,
  // First Sunday of Lent, and Easter Sunday.

  test("Week I on First Sunday of Advent (anchor)", () => {
    const adventSun = firstSundayOfAdvent(Y - 1);
    expect(getPsalterWeek(adventSun)).toBe(1);
  });

  test("Week I on First Sunday of Ordinary Time after Baptism", () => {
    const firstOtSun = addDays(baptismOfTheLord(Y), 7);
    expect(getWeekday(firstOtSun)).toBe("Sunday");
    expect(getPsalterWeek(firstOtSun)).toBe(1);
  });

  test("Week I on First Sunday of Lent", () => {
    const firstLentSun = addDays(ashWednesday(Y), 4);
    expect(getWeekday(firstLentSun)).toBe("Sunday");
    expect(getPsalterWeek(firstLentSun)).toBe(1);
  });

  test("Week I on Easter Sunday", () => {
    expect(getPsalterWeek(easter)).toBe(1);
  });

  test("cycle advances by one each Sunday within a segment", () => {
    const adventSun = firstSundayOfAdvent(Y - 1);
    expect(getPsalterWeek(addDays(adventSun, 7))).toBe(2);
    expect(getPsalterWeek(addDays(adventSun, 14))).toBe(3);
    expect(getPsalterWeek(addDays(adventSun, 21))).toBe(4);
    expect(getPsalterWeek(addDays(adventSun, 28))).toBe(1);
  });
});

describe("getReadingYear", () => {
  // office-spec §12 — two-year cycle; implementation: odd liturgical start year = Year I.

  test("Year I when liturgical year begins in an odd civil year", () => {
    const advent2025 = firstSundayOfAdvent(2025);
    expect(advent2025.getUTCFullYear()).toBe(2025);
    expect(getReadingYear(advent2025)).toBe("I");
    expect(getReadingYear(utcDate(2026, 1, 15))).toBe("I");
  });

  test("Year II when liturgical year begins in an even civil year", () => {
    const advent2026 = firstSundayOfAdvent(2026);
    expect(advent2026.getUTCFullYear()).toBe(2026);
    expect(getReadingYear(advent2026)).toBe("II");
  });
});

describe("getOrdinaryTimeWeek", () => {
  test("returns 0 outside Ordinary Time", () => {
    expect(getOrdinaryTimeWeek(easter)).toBe(0);
    expect(getOrdinaryTimeWeek(ashWednesday(Y))).toBe(0);
  });

  test("OT I: week 1 begins on OT I Monday", () => {
    const otIStart = addDays(baptismOfTheLord(Y), 1);
    expect(getSeason(otIStart)).toBe("ordinary_time");
    expect(getOrdinaryTimeWeek(otIStart)).toBe(1);
  });

  test("OT II: continues after Pentecost Monday", () => {
    const otII = addDays(pentecost(Y), 1);
    expect(getOrdinaryTimeWeek(otII)).toBeGreaterThan(0);
  });

  test("OT II 2026: resumes at week 8 on Monday after Pentecost (33-week year)", () => {
    const otII = addDays(pentecost(Y), 1);
    expect(getOrdinaryTimeWeek(otII)).toBe(8);
    expect(getOrdinaryTimeWeek(utcDate(2026, 7, 12))).toBe(14);
  });
});

describe("getSundayUnderYearNumber", () => {
  test("2026-01-18 is the 2nd Sunday under året (Baptism Sunday counts as 1st)", () => {
    expect(getSundayUnderYearNumber(utcDate(2026, 1, 18))).toBe(2);
  });

  test("2026-07-12 is the 15th Sunday under året per Ordo 2025-2026", () => {
    expect(getSundayUnderYearNumber(utcDate(2026, 7, 12))).toBe(15);
  });
});

describe("getSeasonalDayKey", () => {
  test("Ash Wednesday", () => {
    expect(getSeasonalDayKey(ashWednesday(Y))).toBe("ash_wednesday");
  });

  test("Palm Sunday", () => {
    expect(getSeasonalDayKey(palmSunday(Y))).toBe("palm_sunday");
  });

  test("Advent 17–24 December use fixed keys", () => {
    expect(getSeasonalDayKey(utcDate(Y - 1, 12, 17))).toBe("advent_dec17");
    expect(getSeasonalDayKey(utcDate(Y - 1, 12, 24))).toBe("advent_dec24");
  });

  test("Christmas Day", () => {
    expect(getSeasonalDayKey(utcDate(Y - 1, 12, 25))).toBe("christmas_dec25");
  });

  test("Eastertide octave Monday", () => {
    expect(getSeasonalDayKey(addDays(easter, 1))).toBe("easter_mon");
  });

  test("ordinary ferial yields ot_w*_weekday when in OT", () => {
    const d = utcDate(2026, 6, 3); // Wednesday after Pentecost 2026 (May 24)
    expect(getSeason(d)).toBe("ordinary_time");
    const key = getSeasonalDayKey(d);
    expect(key).toMatch(/^ot_w\d+_wed$/);
  });
});
