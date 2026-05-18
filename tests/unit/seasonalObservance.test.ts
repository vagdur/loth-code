import { describe, expect, test } from "vitest";
import { utcDate } from "../../src/calendar/computus.js";
import {
  ascensionForObservance,
  ascensionSunday,
  corpusChristiForObservance,
  corpusChristiSecondSundayAfterPentecost,
  epiphanyForObservance,
  epiphanySundayJan2to8,
  observanceDate,
} from "../../src/calendar/seasonalObservance.js";
import { DEFAULT_SEASONAL_OBSERVANCE } from "../../src/types/seasonalObservance.js";

describe("seasonal observance dates", () => {
  test("Epiphany sunday_jan_2_8 lands on Sunday between 2–8 Jan", () => {
    expect(epiphanySundayJan2to8(2023).getTime()).toBe(utcDate(2023, 1, 8).getTime());
    expect(epiphanyForObservance(2023, "sunday_jan_2_8").getTime()).toBe(
      utcDate(2023, 1, 8).getTime(),
    );
    expect(epiphanyForObservance(2026, "fixed_jan_6").getTime()).toBe(
      utcDate(2026, 1, 6).getTime(),
    );
  });

  test("Corpus Christi second Sunday after Pentecost — 7 Jun 2026 (Stockholm)", () => {
    expect(corpusChristiSecondSundayAfterPentecost(2026).getTime()).toBe(
      utcDate(2026, 6, 7).getTime(),
    );
    expect(
      corpusChristiForObservance(2026, "second_sunday_after_pentecost").getTime(),
    ).toBe(utcDate(2026, 6, 7).getTime());
  });

  test("Ascension Sunday vs Thursday", () => {
    expect(ascensionForObservance(2026, "thursday").getTime()).toBe(
      utcDate(2026, 5, 14).getTime(),
    );
    expect(ascensionSunday(2026).getTime()).toBe(utcDate(2026, 5, 17).getTime());
    expect(ascensionForObservance(2026, "sunday").getTime()).toBe(
      utcDate(2026, 5, 17).getTime(),
    );
  });

  test("observanceDate dispatches via policy", () => {
    expect(
      observanceDate("corpus_christi", 2026, DEFAULT_SEASONAL_OBSERVANCE).getTime(),
    ).not.toBe(utcDate(2026, 6, 7).getTime());
    expect(
      observanceDate("corpus_christi", 2026, {
        ...DEFAULT_SEASONAL_OBSERVANCE,
        corpusChristi: "second_sunday_after_pentecost",
      }).getTime(),
    ).toBe(utcDate(2026, 6, 7).getTime());
  });
});
