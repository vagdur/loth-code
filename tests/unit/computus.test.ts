/**
 * office-spec §10 (psalter anchors), §20 step 2 — liturgical year depends on
 * correct moveable feasts. Easter computus is the root of Ash Wednesday, Lent,
 * Pentecost, and related boundaries.
 */

import { describe, expect, test } from "vitest";
import {
  addDays,
  ashWednesday,
  ascensionThursday,
  easterSunday,
  holyThursday,
  palmSunday,
  pentecost,
  utcDate,
} from "../../src/calendar/computus.js";

/** Gregorian Easter Sunday (Western) — spot-check against ecclesiastical tables. */
const EASTER_SUNDAY: Array<{ year: number; month: number; day: number }> = [
  { year: 2020, month: 4, day: 12 },
  { year: 2021, month: 4, day: 4 },
  { year: 2022, month: 4, day: 17 },
  { year: 2023, month: 4, day: 9 },
  { year: 2024, month: 3, day: 31 },
  { year: 2025, month: 4, day: 20 },
  { year: 2026, month: 4, day: 5 },
];

function expectUtcDate(actual: Date, year: number, month: number, day: number) {
  expect(actual.getUTCFullYear()).toBe(year);
  expect(actual.getUTCMonth() + 1).toBe(month);
  expect(actual.getUTCDate()).toBe(day);
}

describe("easterSunday", () => {
  test("matches reference Easter Sundays for several civil years", () => {
    for (const { year, month, day } of EASTER_SUNDAY) {
      expectUtcDate(easterSunday(year), year, month, day);
    }
  });
});

describe("derived moveable feasts", () => {
  test("Ash Wednesday is 46 days before Easter", () => {
    for (const { year } of EASTER_SUNDAY) {
      const e = easterSunday(year);
      expect(ashWednesday(year).getTime()).toBe(addDays(e, -46).getTime());
    }
  });

  test("Palm Sunday is 7 days before Easter", () => {
    for (const { year } of EASTER_SUNDAY) {
      expect(palmSunday(year).getTime()).toBe(addDays(easterSunday(year), -7).getTime());
    }
  });

  test("Holy Thursday is 3 days before Easter", () => {
    for (const { year } of EASTER_SUNDAY) {
      expect(holyThursday(year).getTime()).toBe(addDays(easterSunday(year), -3).getTime());
    }
  });

  test("Ascension Thursday is 39 days after Easter", () => {
    for (const { year } of EASTER_SUNDAY) {
      expect(ascensionThursday(year).getTime()).toBe(addDays(easterSunday(year), 39).getTime());
    }
  });

  test("Pentecost is 49 days after Easter", () => {
    for (const { year } of EASTER_SUNDAY) {
      expect(pentecost(year).getTime()).toBe(addDays(easterSunday(year), 49).getTime());
    }
  });
});

describe("utcDate / addDays", () => {
  test("utcDate builds UTC midnight", () => {
    const d = utcDate(2026, 5, 10);
    expect(d.toISOString()).toBe("2026-05-10T00:00:00.000Z");
  });

  test("addDays handles month wrap", () => {
    expectUtcDate(addDays(utcDate(2026, 1, 31), 1), 2026, 2, 1);
  });
});
