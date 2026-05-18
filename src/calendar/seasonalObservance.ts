/**
 * Conference-specific observance dates for seasonal solemnities.
 * Policies come from calendar YAML via SanctoralCalendarRegistry.
 */

import {
  addDays,
  ascensionThursday,
  corpusChristiThursday,
  easterSunday,
  epiphany as epiphanyFixedJan6,
  pentecost,
  utcDate,
} from "./computus.js";
import type {
  AscensionObservance,
  CorpusChristiObservance,
  EpiphanyObservance,
  SeasonalFeast,
  SeasonalObservancePolicy,
} from "../types/seasonalObservance.js";

/** Sunday on or between 2–8 January (US and many conferences). */
export function epiphanySundayJan2to8(year: number): Date {
  for (let day = 2; day <= 8; day++) {
    const d = utcDate(year, 1, day);
    if (d.getUTCDay() === 0) return d;
  }
  throw new Error(`No Sunday between Jan 2–8 in year ${year}`);
}

export function epiphanyForObservance(
  year: number,
  mode: EpiphanyObservance,
): Date {
  switch (mode) {
    case "fixed_jan_6":
      return epiphanyFixedJan6(year);
    case "sunday_jan_2_8":
      return epiphanySundayJan2to8(year);
  }
}

export function corpusChristiSecondSundayAfterPentecost(year: number): Date {
  return addDays(pentecost(year), 14);
}

export function corpusChristiForObservance(
  year: number,
  mode: CorpusChristiObservance,
): Date {
  switch (mode) {
    case "thursday_after_trinity":
      return corpusChristiThursday(year);
    case "second_sunday_after_pentecost":
      return corpusChristiSecondSundayAfterPentecost(year);
  }
}

/** Sunday of the 7th week of Easter (Easter + 42). */
export function ascensionSunday(year: number): Date {
  return addDays(easterSunday(year), 42);
}

export function ascensionForObservance(
  year: number,
  mode: AscensionObservance,
): Date {
  switch (mode) {
    case "thursday":
      return ascensionThursday(year);
    case "sunday":
      return ascensionSunday(year);
  }
}

export function observanceDate(
  feast: SeasonalFeast,
  year: number,
  policy: SeasonalObservancePolicy,
): Date {
  switch (feast) {
    case "epiphany":
      return epiphanyForObservance(year, policy.epiphany);
    case "corpus_christi":
      return corpusChristiForObservance(year, policy.corpusChristi);
    case "ascension":
      return ascensionForObservance(year, policy.ascension);
  }
}

/** Baptism of the Lord depends on when Epiphany is observed. */
export function baptismOfTheLordForPolicy(
  year: number,
  epiphanyMode: EpiphanyObservance,
): Date {
  const ep = epiphanyForObservance(year, epiphanyMode);
  const dow = ep.getUTCDay();
  if (dow === 0) {
    return addDays(ep, 7);
  }
  return addDays(ep, 7 - dow);
}
