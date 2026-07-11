/**
 * Build a full Ordo summary for one liturgical day.
 */

import { resolveDay } from "../calendar/index.js";
import { getSanctoralRegistry } from "../calendar/saints.js";
import { buildDay } from "../hours/index.js";
import { enumerateDayOptions } from "../options/enumerate.js";
import type { DataRepository } from "../data/repository.js";
import type { AssemblyContext, DayClass, LiturgicalDay } from "../types/calendar.js";
import type { DayOption } from "../types/options.js";
import type { HourKey } from "../options/slotTable.js";
import { compactOrdoDayBody } from "./compactDay.js";
import { formatFerialTitle } from "./ferialTitle.js";
import { lookupSeasonalName } from "./seasonalNames.js";
import { getOrdoLabels } from "./labels.js";
import { formatPsalterWeekLine } from "./psalterWeekLabel.js";
import { formatSundayTitle } from "./sundayTitle.js";

export interface OrdoHourSummary {
  key: HourKey | "daytime" | "firstVespers";
  label: string;
  prose: string;
}

export interface OrdoDaySummary {
  date: Date;
  headline: string;
  /** Psalter cycle week for this day, e.g. "Psaltarets vecka II". */
  psalterWeekLine: string;
  celebrationOptions?: string;
  /** Commune line shown once under the headline when a saint common applies. */
  communeLine?: string;
  /** Single-line default when the whole day matches a baseline profile. */
  defaultBody?: string;
  hours: OrdoHourSummary[];
  /** Compact hour summaries when an optional memoria is celebrated. */
  memoriaIfCelebrated?: OrdoHourSummary[];
  /** Commune line for the optional memoria block. */
  memoriaCommuneLine?: string;
}

const RANK_KEYS: Record<DayClass, keyof import("../types/texts.js").OrdoLabels["ranks"]> = {
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

function rankLabel(type: DayClass, ranks: import("../types/texts.js").OrdoLabels["ranks"]): string {
  const key = RANK_KEYS[type];
  return ranks[key] ?? type;
}

function formatCelebrationOptions(
  options: DayOption[],
  alternativesLabel: string,
): string | undefined {
  const celeb = options.find((o) => o.kind === "celebration");
  if (!celeb || celeb.choices.length < 2) return undefined;
  const alts = celeb.choices.map((c) => c.label).join(" / ");
  return `${alternativesLabel} ${alts}`;
}

export function summarizeOrdoDay(
  date: Date,
  context: AssemblyContext,
  repo: DataRepository,
): OrdoDaySummary {
  const labels = getOrdoLabels(repo);
  const { options, effectiveChoices } = enumerateDayOptions(date, context, repo);
  const day = resolveDay(date, context.calendarId, effectiveChoices);
  const abstractDay = buildDay(day, context, effectiveChoices);

  const dateLabel = formatDateSv(date, labels.months);
  const headline = isFerial(day.celebration.type)
    ? `${dateLabel}. ${formatFerialTitle(day.celebration.seasonalKey, labels, date, context.calendarId)}.`
    : day.celebration.type === "sunday"
      ? `${dateLabel}. ${formatSundayTitle(day.celebration.seasonalKey, labels, date, context.calendarId)}.`
      : `${dateLabel}. ${celebrationName(
        day,
        context.calendarId,
        labels.seasonalNames,
      )}. ${rankLabel(day.celebration.type, labels.ranks)}.`;

  const celebrationOptions = formatCelebrationOptions(options, labels.prose.alternatives);
  const compacted = compactOrdoDayBody(
    day,
    abstractDay,
    options,
    effectiveChoices,
    context,
    repo,
    labels,
  );

  return {
    date,
    headline,
    psalterWeekLine: formatPsalterWeekLine(day.psalterWeek, labels),
    ...(celebrationOptions ? { celebrationOptions } : {}),
    ...(compacted.communeLine ? { communeLine: compacted.communeLine } : {}),
    ...(compacted.defaultBody ? { defaultBody: compacted.defaultBody } : {}),
    hours: compacted.hours.filter((h) => h.prose.length > 0),
    ...(compacted.memoriaIfCelebrated?.length
      ? { memoriaIfCelebrated: compacted.memoriaIfCelebrated }
      : {}),
    ...(compacted.memoriaCommuneLine
      ? { memoriaCommuneLine: compacted.memoriaCommuneLine }
      : {}),
  };
}
