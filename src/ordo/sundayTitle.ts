/**
 * Human-readable Swedish titles for seasonal Sundays in the Ordo headline.
 */

import { getSundayUnderYearNumber } from "../calendar/liturgicalYear.js";
import { adventWeekNumber } from "./adventWeek.js";
import { christmasSundayNumber } from "./christmasSunday.js";
import type { OrdoLabels } from "../types/texts.js";
import { lookupSeasonalName } from "./seasonalNames.js";
import { applyTemplate, capitalizeFirst, ordinalWeek } from "./ordinals.js";

function sundayInSeasonTitle(template: string, week: number): string {
  return capitalizeFirst(applyTemplate(template, { week: ordinalWeek(week) }));
}

export function formatSundayTitle(
  seasonalKey: string | null | undefined,
  labels: OrdoLabels,
  date?: Date,
  calendarId = "general",
): string {
  const prose = labels.prose;
  if (!seasonalKey) {
    return labels.ranks.sunday ?? "Söndag";
  }

  if (/^christmas_jan0[2-5]$/.test(seasonalKey) && date?.getUTCDay() === 0) {
    const template = prose.sundayAfterChristmas ?? "{week} söndagen efter jul";
    return sundayInSeasonTitle(template, christmasSundayNumber(date, calendarId));
  }

  const named = lookupSeasonalName(seasonalKey, labels.seasonalNames);
  if (named) return named;

  const otSun = /^ot_w(\d+)_sun$/.exec(seasonalKey);
  if (otSun && prose.otSunday && date) {
    const n = getSundayUnderYearNumber(date, calendarId);
    return prose.otSunday.replace("{n}", String(n));
  }

  const weekly = /^(advent|lent|easter)_w(\d+)_sun$/.exec(seasonalKey);
  if (weekly) {
    const week = Number(weekly[2]);
    switch (weekly[1]) {
      case "advent":
        return sundayInSeasonTitle(
          prose.sundayInAdvent ?? "{week} söndagen i Advent",
          week,
        );
      case "lent":
        return sundayInSeasonTitle(
          prose.sundayInLent ?? "{week} söndagen i fastan",
          week,
        );
      case "easter":
        return sundayInSeasonTitle(
          prose.sundayInEaster ?? "{week} söndagen i påsktiden",
          week,
        );
    }
  }

  if (/^advent_dec(1[7-9]|2[0-4])$/.test(seasonalKey) && date && prose.sundayInAdvent) {
    return sundayInSeasonTitle(prose.sundayInAdvent, adventWeekNumber(date, calendarId));
  }

  return seasonalKey;
}
