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
import { formatFerialTitle } from "./ferialTitle.js";
import { lookupSeasonalName } from "./seasonalNames.js";
import { getOrdoLabels } from "./labels.js";
import { formatSundayTitle } from "./sundayTitle.js";
import {
  summarizeCompline, summarizeDaytime, summarizeInvitatory,
  summarizeLauds, summarizeOfficeOfReadings, summarizeVespers,
} from "./summarizeHour.js";
import { partLabelForSlotKey } from "./partLabels.js";

export interface OrdoHourSummary {
  key: HourKey | "daytime";
  label: string;
  prose: string;
}

export interface OrdoDaySummary {
  date: Date;
  headline: string;
  celebrationOptions?: string;
  hours: OrdoHourSummary[];
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

function annotateHourProse(
  hourPrefix: string,
  prose: string,
  options: DayOption[],
  labels: import("../types/texts.js").OrdoLabels,
): string {
  const notes: string[] = [];
  for (const opt of options) {
    if (opt.kind === "melody") continue;
    if (opt.kind === "part_source" && opt.id.startsWith(`${hourPrefix}.`)) {
      const slot = opt.id.replace(/\.source$/, "").split(".").pop() ?? opt.id;
      const slotKey = slot.replace(/\[\d+\]/, "");
      const partName = partLabelForSlotKey(slotKey, labels) ?? slotKey;
      const alts = opt.choices.map((c) => c.label).join(` ${labels.prose.and} `);
      notes.push(`${partName}: ${alts}`);
    }
    if (
      opt.kind === "psalmody" &&
      hourPrefix === "sext" &&
      opt.id === "sext.psalmody"
    ) {
      notes.push(labels.prose.psalmodyOption);
    }
  }
  if (notes.length === 0) return prose;
  return `${prose} (${notes.join("; ")})`;
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

  const hours: OrdoHourSummary[] = [];

  if (context.oorIsFirstHour) {
    hours.push({
      key: "invitatory",
      label: labels.hours.invitatory,
      prose: annotateHourProse(
        "invitatory",
        summarizeInvitatory(abstractDay.invitatory, repo, labels, effectiveChoices),
        options,
        labels,
      ),
    });
  }

  hours.push({
    key: "officeOfReadings",
    label: labels.hours.officeOfReadings,
    prose: annotateHourProse(
      "officeOfReadings",
      summarizeOfficeOfReadings(abstractDay.officeOfReadings, repo, labels, effectiveChoices),
      options,
      labels,
    ),
  });

  hours.push({
    key: "lauds",
    label: labels.hours.lauds,
    prose: annotateHourProse(
      "lauds",
      summarizeLauds(abstractDay.lauds, repo, labels, effectiveChoices),
      options,
      labels,
    ),
  });

  if (abstractDay.sext) {
    hours.push({
      key: "daytime",
      label: labels.hours.daytime,
      prose: annotateHourProse(
        "sext",
        summarizeDaytime(abstractDay.sext, repo, labels, effectiveChoices),
        options,
        labels,
      ),
    });
  }

  hours.push({
    key: "vespers",
    label: labels.hours.vespers,
    prose: annotateHourProse(
      "vespers",
      summarizeVespers(abstractDay.vespers, "vespers", repo, labels, effectiveChoices),
      options,
      labels,
    ),
  });

  if (abstractDay.firstVespers) {
    hours.push({
      key: "firstVespers",
      label: labels.hours.firstVespers,
      prose: annotateHourProse(
        "firstVespers",
        summarizeVespers(
          abstractDay.firstVespers,
          "firstVespers",
          repo,
          labels,
          effectiveChoices,
        ),
        options,
        labels,
      ),
    });
  }

  hours.push({
    key: "compline",
    label: labels.hours.compline,
    prose: annotateHourProse(
      "compline",
      summarizeCompline(day, labels),
      options,
      labels,
    ),
  });

  const celebrationOptions = formatCelebrationOptions(options, labels.prose.alternatives);

  return {
    date,
    headline,
    ...(celebrationOptions ? { celebrationOptions } : {}),
    hours: hours.filter((h) => h.prose.length > 0),
  };
}
