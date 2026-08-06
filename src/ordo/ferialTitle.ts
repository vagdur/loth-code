/**
 * Human-readable titles for ferial days in the Ordo headline. The wording is
 * the locale's: prose templates, weekday names and ordinals all come from
 * `labels.ordo`.
 */

import type { Weekday } from "../types/psalter.js";
import type { OrdoLabels } from "../types/texts.js";
import { adventWeekNumber } from "./adventWeek.js";
import { lookupSeasonalName } from "./seasonalNames.js";
import { applyTemplate, capitalizeFirst, ordinalWeek } from "./ordinals.js";

const WEEKDAYS: Weekday[] = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];

const DOW_SUFFIX: Record<string, Weekday> = {
  sun: "Sunday",
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
};

const HOLY_WEEK_KEYS: Record<string, string> = {
  holy_monday: "mon",
  holy_tuesday: "tue",
  holy_wednesday: "wed",
};

function weekdayLabel(labels: OrdoLabels, weekday: Weekday): string {
  return capitalizeFirst(labels.weekdays[weekday] ?? weekday);
}

function weekdayFromSuffix(suffix: string, labels: OrdoLabels): string | null {
  const weekday = DOW_SUFFIX[suffix];
  return weekday ? weekdayLabel(labels, weekday) : null;
}

function weekdayFromDate(date: Date, labels: OrdoLabels): string {
  const weekday = WEEKDAYS[date.getUTCDay()]!;
  return weekdayLabel(labels, weekday);
}

function weeklyFerialTitle(
  labels: OrdoLabels,
  weekday: string,
  week: number,
  template: string,
): string {
  return applyTemplate(template, { weekday, week: ordinalWeek(week, labels) });
}

export function formatFerialTitle(
  seasonalKey: string | null | undefined,
  labels: OrdoLabels,
  date?: Date,
  calendarId = "general",
): string {
  const prose = labels.prose;
  if (!seasonalKey) {
    return labels.ranks.ordinaryFerial ?? "Vardag";
  }

  if (/^advent_dec(1[7-9]|2[0-4])$/.test(seasonalKey) && date) {
    return weeklyFerialTitle(
      labels,
      weekdayFromDate(date, labels),
      adventWeekNumber(date, calendarId),
      prose.ferialInAdvent ?? "{weekday} i {week} veckan i advent",
    );
  }

  const weekly = /^(advent|lent|easter|ot)_w(\d+)_(sun|mon|tue|wed|thu|fri|sat)$/.exec(seasonalKey);
  if (weekly) {
    const weekday = weekdayFromSuffix(weekly[3]!, labels);
    if (!weekday) return seasonalKey;
    const week = Number(weekly[2]);
    switch (weekly[1]) {
      case "advent":
        return weeklyFerialTitle(labels, weekday, week, prose.ferialInAdvent ?? "{weekday} i {week} veckan i advent");
      case "lent":
        return weeklyFerialTitle(labels, weekday, week, prose.ferialInLent ?? "{weekday} i {week} veckan i fastan");
      case "easter":
        return weeklyFerialTitle(labels, weekday, week, prose.ferialInEaster ?? "{weekday} i {week} veckan i påsktiden");
      case "ot":
        return weeklyFerialTitle(labels, weekday, week, prose.ferialInOt ?? "{weekday} i {week} veckan under året");
    }
  }

  const epiphanyWeekday = /^epiphany_(sun|mon|tue|wed|thu|fri|sat)$/.exec(seasonalKey);
  if (epiphanyWeekday && prose.ferialInEpiphany) {
    const weekday = weekdayFromSuffix(epiphanyWeekday[1]!, labels);
    if (weekday) return applyTemplate(prose.ferialInEpiphany, { weekday });
  }

  if (/^christmas_dec(2[6-9]|3[01])$/.test(seasonalKey) && prose.ferialInChristmasOctave) {
    const decDay = Number(/^christmas_dec(\d+)$/.exec(seasonalKey)![1]);
    const octaveDay = decDay - 24; // Dec 26 = 2nd day of the octave (Christmas is day 1)
    return applyTemplate(prose.ferialInChristmasOctave, {
      day: ordinalWeek(octaveDay, labels),
    });
  }

  if (/^christmas_jan0[2-5]$/.test(seasonalKey) && prose.ferialInChristmas) {
    const weekday = date ? weekdayFromDate(date, labels) : "Vardag";
    return applyTemplate(prose.ferialInChristmas, { weekday });
  }

  if (seasonalKey in HOLY_WEEK_KEYS && prose.ferialInHolyWeek) {
    const weekday = weekdayFromSuffix(HOLY_WEEK_KEYS[seasonalKey]!, labels)
      ?? (date ? weekdayFromDate(date, labels) : "Vardag");
    return applyTemplate(prose.ferialInHolyWeek, { weekday });
  }

  const easterOctave = /^easter_(mon|tue|wed|thu|fri|sat)$/.exec(seasonalKey);
  if (easterOctave && prose.ferialInEasterOctave) {
    const weekday = weekdayFromSuffix(easterOctave[1]!, labels);
    if (weekday) return applyTemplate(prose.ferialInEasterOctave, { weekday });
  }

  return lookupSeasonalName(seasonalKey, labels.seasonalNames) ?? seasonalKey;
}
