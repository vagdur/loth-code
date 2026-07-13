/**
 * Build a full Ordo summary for one liturgical day.
 */

import { resolveDay } from "../calendar/index.js";
import { buildDay } from "../hours/index.js";
import { enumerateDayOptions } from "../options/enumerate.js";
import type { DataRepository } from "../data/repository.js";
import type { AssemblyContext } from "../types/calendar.js";
import type { DayOption } from "../types/options.js";
import type { HourKey } from "../options/slotTable.js";
import { compactOrdoDayBody, type OrdoMemoriaBlock } from "./compactDay.js";
import { formatOrdoDayHeadline } from "./headline.js";
import { getOrdoLabels } from "./labels.js";
import { formatPsalterWeekLine } from "./psalterWeekLabel.js";

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
  /** Per-saint blocks when optional memorials may be celebrated. */
  memoriaBlocks?: OrdoMemoriaBlock[];
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

  const headline = formatOrdoDayHeadline(day, labels, context.calendarId);

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
    ...(compacted.memoriaBlocks?.length ? { memoriaBlocks: compacted.memoriaBlocks } : {}),
  };
}
