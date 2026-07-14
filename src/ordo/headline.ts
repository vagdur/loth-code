/**
 * Ordo day headline — date plus celebration title, as shown in the Ordo PDF.
 */

import { getSanctoralRegistry } from "../calendar/saints.js";
import type { DayClass, LiturgicalDay } from "../types/calendar.js";
import type { OrdoLabels } from "../types/texts.js";
import { formatFerialTitle } from "./ferialTitle.js";
import { lookupSeasonalName } from "./seasonalNames.js";
import { formatSundayTitle } from "./sundayTitle.js";

const RANK_KEYS: Record<DayClass, keyof OrdoLabels["ranks"]> = {
  triduum: "triduum",
  sunday: "sunday",
  solemnity: "solemnity",
  feast_of_lord_on_sunday: "feastOfLordOnSunday",
  feast: "feast",
  obligatory_memoria: "obligatoryMemoria",
  optional_memoria: "optionalMemoria",
  privileged_ferial: "privilegedFerial",
  ordinary_ferial: "ordinaryFerial",
};

function formatDateSv(date: Date, months: string[]): string {
  const day = date.getUTCDate();
  const month = months[date.getUTCMonth()] ?? "";
  return `${day} ${month}`;
}

function celebrationName(
  day: LiturgicalDay,
  calendarId: string,
  seasonalNames?: Record<string, string>,
): string {
  const { celebration: c } = day;
  if (c.source === "saint" && c.saintId) {
    const saints = getSanctoralRegistry().getSaints(calendarId);
    const saint = saints.find((s) => s.saintId === c.saintId);
    return saint?.name ?? c.saintId;
  }
  if (c.seasonalKey) {
    const named = lookupSeasonalName(c.seasonalKey, seasonalNames);
    if (named) return named;
    return c.seasonalKey;
  }
  return "Feria";
}

function isFerial(type: DayClass): boolean {
  return type === "privileged_ferial" || type === "ordinary_ferial";
}

function rankLabel(type: DayClass, ranks: OrdoLabels["ranks"]): string {
  const key = RANK_KEYS[type];
  return ranks[key] ?? type;
}

export function formatOrdoDayHeadline(
  day: LiturgicalDay,
  labels: OrdoLabels,
  calendarId = "general",
): string {
  const dateLabel = formatDateSv(day.date, labels.months);
  if (isFerial(day.celebration.type)) {
    return `${dateLabel}. ${formatFerialTitle(day.celebration.seasonalKey, labels, day.date, calendarId)}.`;
  }
  if (day.celebration.type === "sunday") {
    return `${dateLabel}. ${formatSundayTitle(day.celebration.seasonalKey, labels, day.date, calendarId)}.`;
  }
  return `${dateLabel}. ${celebrationName(
    day,
    calendarId,
    labels.seasonalNames,
  )}. ${rankLabel(day.celebration.type, labels.ranks)}.`;
}
