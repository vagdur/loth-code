/**
 * Day-level Ordo compaction — baseline profiles and delta-only output.
 */

import { resolveDay } from "../calendar/index.js";
import { buildDay } from "../hours/index.js";
import type { DataRepository } from "../data/repository.js";
import type {
  AssemblyContext, DayClass, LiturgicalDay, Season,
} from "../types/calendar.js";
import type { DayChoices, DayOption } from "../types/options.js";
import type { HourKey } from "../options/slotTable.js";
import type { AbstractDay } from "../types/hours.js";
import type { OrdoLabels } from "../types/texts.js";
import {
  compactHourProse, dayCommuneVariantFromHourEntryLists, hourEntriesEquivalent, type SlotEntry,
} from "./compactHour.js";
import { summarizeComplineLabel } from "./complineLabel.js";
import { collectHourEntries } from "./summarizeHour.js";
import type { OrdoHourSummary } from "./summarizeDay.js";

type DayBaselineProfile =
  | "ordinary_ferial"
  | "seasonal_ferial"
  | "seasonal_sunday"
  | "solemnity"
  | "feast"
  | "obligatory_memoria"
  | "optional_memoria"
  | "triduum";

type ResolvedHourKey = HourKey | "daytime" | "firstVespers";

interface HourSpec {
  key: ResolvedHourKey;
  labelKey: keyof OrdoLabels["hours"];
  hourKey: string;
  collectFrom: (day: AbstractDay) => Parameters<typeof collectHourEntries>[0] | null;
  teDeum?: (day: AbstractDay) => boolean;
  isFirstVespers?: boolean;
}

const HOUR_SPECS: HourSpec[] = [
  {
    key: "invitatory",
    labelKey: "invitatory",
    hourKey: "invitatory",
    collectFrom: (d) => d.invitatory,
  },
  {
    key: "officeOfReadings",
    labelKey: "officeOfReadings",
    hourKey: "officeOfReadings",
    collectFrom: (d) => d.officeOfReadings,
    teDeum: (d) => d.officeOfReadings.flags.teDeum,
  },
  {
    key: "lauds",
    labelKey: "lauds",
    hourKey: "lauds",
    collectFrom: (d) => d.lauds,
  },
  {
    key: "daytime",
    labelKey: "daytime",
    hourKey: "sext",
    collectFrom: (d) => d.sext ?? null,
  },
  {
    key: "vespers",
    labelKey: "vespers",
    hourKey: "vespers",
    collectFrom: (d) => d.vespers,
  },
  {
    key: "firstVespers",
    labelKey: "firstVespers",
    hourKey: "firstVespers",
    collectFrom: (d) => d.firstVespers ?? null,
    isFirstVespers: true,
  },
  {
    key: "compline",
    labelKey: "compline",
    hourKey: "compline",
    collectFrom: () => null,
  },
];

function isFerial(type: DayClass): boolean {
  return type === "privileged_ferial" || type === "ordinary_ferial";
}

function getDayProfile(
  day: LiturgicalDay,
  hasCelebrationChoice: boolean,
): DayBaselineProfile {
  if (day.celebration.isTriduum) return "triduum";
  if (hasCelebrationChoice) return "optional_memoria";
  if (isFerial(day.celebration.type)) {
    return day.celebration.type === "ordinary_ferial" ? "ordinary_ferial" : "seasonal_ferial";
  }
  if (day.celebration.type === "sunday") return "seasonal_sunday";
  if (day.celebration.type === "obligatory_memoria") return "obligatory_memoria";
  if (day.celebration.type === "solemnity") return "solemnity";
  return "feast";
}

function isBaselineSourceGroup(groupKey: string, season: Season): boolean {
  if (groupKey.startsWith("psalter:")) return true;
  if (groupKey.startsWith("seasonal:")) return true;
  if (groupKey.startsWith("psalm:")) return true;
  if (groupKey === "fixed") return true;
  if (groupKey.startsWith("canticle:")) return true;
  if (season === "ordinary_time" && groupKey.startsWith("seasonal:")) return true;
  return false;
}

function hourMatchesFerialBaseline(
  entries: SlotEntry[],
  season: Season,
): boolean {
  if (entries.length === 0) return true;
  return entries.every((e) => isBaselineSourceGroup(e.described.groupKey, season));
}

function isSundayPsalterOnly(entries: SlotEntry[]): boolean {
  if (entries.length === 0) return false;
  return entries.every((e) => {
    const k = e.described.groupKey;
    return (
      (k.startsWith("psalter:") && k.endsWith(":Sunday")) ||
      k.startsWith("seasonal:")
    );
  });
}

function firstVespersSundayShortcut(
  abstractDay: AbstractDay,
  entries: SlotEntry[],
  labels: OrdoLabels,
): string | null {
  const fv = abstractDay.firstVespers;
  if (
    !fv?.isFirstVespers ||
    fv.liturgicalDay.evening.firstVespersCelebration?.type !== "sunday" ||
    !isSundayPsalterOnly(entries)
  ) {
    return null;
  }
  return `${labels.prose.firstVespersForSunday} ${labels.prose.allFromSunday}`;
}

function collectEntriesForSpec(
  spec: HourSpec,
  abstractDay: AbstractDay,
  repo: DataRepository,
  labels: OrdoLabels,
  choices?: DayChoices,
): SlotEntry[] {
  const hour = spec.collectFrom(abstractDay);
  if (!hour) return [];
  return collectHourEntries(hour, spec.hourKey, repo, labels, choices);
}

function collectHourEntriesBySpec(
  abstractDay: AbstractDay,
  repo: DataRepository,
  labels: OrdoLabels,
  choices?: DayChoices,
): SlotEntry[][] {
  const lists: SlotEntry[][] = [];
  for (const spec of HOUR_SPECS) {
    if (spec.key === "compline") continue;
    lists.push(collectEntriesForSpec(spec, abstractDay, repo, labels, choices));
  }
  return lists;
}

function collectDeltaHourEntryLists(
  ferialAbstractDay: AbstractDay,
  otherAbstractDay: AbstractDay,
  repo: DataRepository,
  labels: OrdoLabels,
  ferialChoices: DayChoices,
  otherChoices: DayChoices,
): SlotEntry[][] {
  const lists: SlotEntry[][] = [];
  for (const spec of HOUR_SPECS) {
    if (spec.key === "compline") continue;
    const ferialEntries = collectEntriesForSpec(
      spec, ferialAbstractDay, repo, labels, ferialChoices,
    );
    const otherEntries = collectEntriesForSpec(
      spec, otherAbstractDay, repo, labels, otherChoices,
    );
    if (hourEntriesEquivalent(ferialEntries, otherEntries)) continue;
    lists.push(otherEntries);
  }
  return lists;
}

function formatDayCommuneLine(
  variant: string,
  labels: OrdoLabels,
): string {
  return (labels.prose.dayCommune ?? "Från commune: {name}").replace("{name}", variant);
}

function buildCompactHour(
  spec: HourSpec,
  liturgicalDay: LiturgicalDay,
  abstractDay: AbstractDay,
  entries: SlotEntry[],
  labels: OrdoLabels,
  dayCommuneVariant?: string,
): OrdoHourSummary | null {
  if (spec.key === "compline") {
    return {
      key: "compline",
      label: labels.hours.compline,
      prose: summarizeComplineLabel(liturgicalDay, labels),
    };
  }

  if (entries.length === 0) return null;

  if (spec.isFirstVespers) {
    const shortcut = firstVespersSundayShortcut(abstractDay, entries, labels);
    if (shortcut) {
      return {
        key: "firstVespers",
        label: labels.hours.firstVespers,
        prose: shortcut,
      };
    }
  }

  const suffix = spec.teDeum?.(abstractDay) ? labels.prose.teDeumSaid : undefined;
  const prose = compactHourProse(entries, labels, {
    ...(suffix ? { suffix } : {}),
    hourKey: spec.hourKey,
    ...(dayCommuneVariant ? { dayCommuneVariant } : {}),
    feriaPsalter: {
      week: liturgicalDay.psalterWeek,
      day: liturgicalDay.psalterDay,
    },
    psalterBaseline: liturgicalDay.celebration.type === "sunday" ? "sunday" : "feria",
  });
  if (!prose) return null;

  return {
    key: spec.key,
    label: labels.hours[spec.labelKey],
    prose,
  };
}

function allHoursMatchFerialBaseline(
  abstractDay: AbstractDay,
  season: Season,
  repo: DataRepository,
  labels: OrdoLabels,
  choices?: DayChoices,
): boolean {
  for (const spec of HOUR_SPECS) {
    if (spec.key === "compline" || spec.key === "firstVespers") continue;
    const entries = collectEntriesForSpec(spec, abstractDay, repo, labels, choices);
    if (!hourMatchesFerialBaseline(entries, season)) return false;
  }
  return true;
}

function allHoursMatchSundayBaseline(
  abstractDay: AbstractDay,
  repo: DataRepository,
  labels: OrdoLabels,
  choices?: DayChoices,
): boolean {
  for (const spec of HOUR_SPECS) {
    if (spec.key === "compline" || spec.key === "firstVespers") continue;
    const entries = collectEntriesForSpec(spec, abstractDay, repo, labels, choices);
    if (!hourMatchesFerialBaseline(entries, abstractDay.liturgicalDay.season)) {
      return false;
    }
  }
  return true;
}

function buildAllCompactHours(
  liturgicalDay: LiturgicalDay,
  abstractDay: AbstractDay,
  repo: DataRepository,
  labels: OrdoLabels,
  choices?: DayChoices,
  includeCompline = true,
  dayCommuneVariant?: string,
): OrdoHourSummary[] {
  const hours: OrdoHourSummary[] = [];
  for (const spec of HOUR_SPECS) {
    if (!includeCompline && spec.key === "compline") continue;
    if (spec.key === "invitatory" && !abstractDay.invitatory) continue;
    const entries = collectEntriesForSpec(spec, abstractDay, repo, labels, choices);
    const hour = buildCompactHour(
      spec, liturgicalDay, abstractDay, entries, labels, dayCommuneVariant,
    );
    if (hour) hours.push(hour);
  }
  return hours;
}

function buildDeltaHours(
  ferialAbstractDay: AbstractDay,
  otherAbstractDay: AbstractDay,
  liturgicalDay: LiturgicalDay,
  repo: DataRepository,
  labels: OrdoLabels,
  ferialChoices: DayChoices,
  otherChoices: DayChoices,
  dayCommuneVariant?: string,
): OrdoHourSummary[] {
  const hours: OrdoHourSummary[] = [];
  for (const spec of HOUR_SPECS) {
    if (spec.key === "compline") continue;
    if (spec.key === "invitatory" && !otherAbstractDay.invitatory) continue;
    const ferialEntries = collectEntriesForSpec(
      spec, ferialAbstractDay, repo, labels, ferialChoices,
    );
    const otherEntries = collectEntriesForSpec(
      spec, otherAbstractDay, repo, labels, otherChoices,
    );
    if (hourEntriesEquivalent(ferialEntries, otherEntries)) continue;
    const hour = buildCompactHour(
      spec, liturgicalDay, otherAbstractDay, otherEntries, labels, dayCommuneVariant,
    );
    if (hour) hours.push(hour);
  }
  return hours;
}

function exceptionalFirstVespers(
  abstractDay: AbstractDay,
  repo: DataRepository,
  labels: OrdoLabels,
  choices?: DayChoices,
  dayCommuneVariant?: string,
): OrdoHourSummary | null {
  const spec = HOUR_SPECS.find((s) => s.key === "firstVespers")!;
  const entries = collectEntriesForSpec(spec, abstractDay, repo, labels, choices);
  if (entries.length === 0) return null;
  const shortcut = firstVespersSundayShortcut(abstractDay, entries, labels);
  if (shortcut) {
    return {
      key: "firstVespers",
      label: labels.hours.firstVespers,
      prose: shortcut,
    };
  }
  return buildCompactHour(
    spec, abstractDay.liturgicalDay, abstractDay, entries, labels, dayCommuneVariant,
  );
}

function celebrationChoiceId(options: DayOption[]): string | undefined {
  const celeb = options.find((o) => o.kind === "celebration");
  if (!celeb || celeb.choices.length < 2) return undefined;
  const nonFeria = celeb.choices.find((c) => c.id !== "feria");
  return nonFeria?.id ?? celeb.choices[1]?.id;
}

export interface CompactedDayBody {
  defaultBody?: string;
  communeLine?: string;
  hours: OrdoHourSummary[];
  memoriaIfCelebrated?: OrdoHourSummary[];
  memoriaCommuneLine?: string;
}

function dayCommuneForHourEntryLists(
  hourEntryLists: SlotEntry[][],
  labels: OrdoLabels,
): { variant: string | null; line?: string } {
  const variant = dayCommuneVariantFromHourEntryLists(hourEntryLists, labels);
  return {
    variant,
    ...(variant ? { line: formatDayCommuneLine(variant, labels) } : {}),
  };
}

function dayCommuneForAbstract(
  abstractDay: AbstractDay,
  repo: DataRepository,
  labels: OrdoLabels,
  choices?: DayChoices,
): { variant: string | null; line?: string } {
  return dayCommuneForHourEntryLists(
    collectHourEntriesBySpec(abstractDay, repo, labels, choices),
    labels,
  );
}

export function compactOrdoDayBody(
  liturgicalDay: LiturgicalDay,
  abstractDay: AbstractDay,
  options: DayOption[],
  effectiveChoices: DayChoices,
  context: AssemblyContext,
  repo: DataRepository,
  labels: OrdoLabels,
): CompactedDayBody {
  const hasCelebrationChoice = options.some(
    (o) => o.kind === "celebration" && o.choices.length >= 2,
  );
  const profile = getDayProfile(liturgicalDay, hasCelebrationChoice);
  const season = liturgicalDay.season;

  if (profile === "optional_memoria") {
    const ferialChoices: DayChoices = { ...effectiveChoices, celebration: "feria" };
    const ferialDay = resolveDay(liturgicalDay.date, context.calendarId, ferialChoices);
    const ferialAbstract = buildDay(ferialDay, context, ferialChoices);

    const memoriaChoiceId = celebrationChoiceId(options);
    const memoriaChoices: DayChoices = {
      ...effectiveChoices,
      ...(memoriaChoiceId ? { celebration: memoriaChoiceId } : {}),
    };
    const memoriaDay = resolveDay(liturgicalDay.date, context.calendarId, memoriaChoices);
    const memoriaAbstract = buildDay(memoriaDay, context, memoriaChoices);

    const memoriaCommune = dayCommuneForHourEntryLists(
      collectDeltaHourEntryLists(
        ferialAbstract, memoriaAbstract, repo, labels, ferialChoices, memoriaChoices,
      ),
      labels,
    );
    const defaultBody = labels.prose.allFromFeria;
    const firstVespers = exceptionalFirstVespers(ferialAbstract, repo, labels, ferialChoices);
    const memoriaHours = buildDeltaHours(
      ferialAbstract,
      memoriaAbstract,
      liturgicalDay,
      repo,
      labels,
      ferialChoices,
      memoriaChoices,
      memoriaCommune.variant ?? undefined,
    );

    return {
      defaultBody,
      hours: firstVespers ? [firstVespers] : [],
      ...(memoriaHours.length > 0 ? { memoriaIfCelebrated: memoriaHours } : {}),
      ...(memoriaCommune.line ? { memoriaCommuneLine: memoriaCommune.line } : {}),
    };
  }

  const dayCommune = dayCommuneForAbstract(
    abstractDay, repo, labels, effectiveChoices,
  );
  const communeFields = dayCommune.line ? { communeLine: dayCommune.line } : {};
  const dayCommuneVariant = dayCommune.variant ?? undefined;

  if (profile === "ordinary_ferial" || profile === "seasonal_ferial") {
    if (allHoursMatchFerialBaseline(abstractDay, season, repo, labels, effectiveChoices)) {
      const firstVespers = exceptionalFirstVespers(
        abstractDay, repo, labels, effectiveChoices, dayCommuneVariant,
      );
      return {
        ...communeFields,
        defaultBody: labels.prose.allFromFeria,
        hours: firstVespers ? [firstVespers] : [],
      };
    }
    return {
      ...communeFields,
      hours: buildAllCompactHours(
        liturgicalDay, abstractDay, repo, labels, effectiveChoices, true, dayCommuneVariant,
      ),
    };
  }

  if (profile === "seasonal_sunday") {
    const firstVespers = exceptionalFirstVespers(
      abstractDay, repo, labels, effectiveChoices, dayCommuneVariant,
    );
    if (allHoursMatchSundayBaseline(abstractDay, repo, labels, effectiveChoices)) {
      return {
        ...communeFields,
        defaultBody: labels.prose.allFromSunday,
        hours: firstVespers ? [firstVespers] : [],
      };
    }
    const hours = buildAllCompactHours(
      liturgicalDay, abstractDay, repo, labels, effectiveChoices, true, dayCommuneVariant,
    );
    return { ...communeFields, hours };
  }

  if (profile === "obligatory_memoria") {
    const ferialChoices: DayChoices = { ...effectiveChoices, celebration: "feria" };
    const ferialDay = resolveDay(liturgicalDay.date, context.calendarId, ferialChoices);
    const ferialAbstract = buildDay(ferialDay, context, ferialChoices);

    if (
      liturgicalDay.celebration.allowMemoriaAddendum &&
      isFerial(ferialDay.celebration.type) &&
      allHoursMatchFerialBaseline(ferialAbstract, season, repo, labels, ferialChoices)
    ) {
      const firstVespers = exceptionalFirstVespers(
        abstractDay, repo, labels, effectiveChoices, dayCommuneVariant,
      );
      return {
        ...communeFields,
        defaultBody: `${labels.prose.allFromFeria} ${labels.prose.memoriaAddendum}`,
        hours: firstVespers ? [firstVespers] : [],
      };
    }

    const deltaHours = buildDeltaHours(
      ferialAbstract,
      abstractDay,
      liturgicalDay,
      repo,
      labels,
      ferialChoices,
      effectiveChoices,
      dayCommuneVariant,
    );
    const firstVespers = exceptionalFirstVespers(
      abstractDay, repo, labels, effectiveChoices, dayCommuneVariant,
    );

    if (deltaHours.length === 0) {
      const hours = buildAllCompactHours(
        liturgicalDay, abstractDay, repo, labels, effectiveChoices, true, dayCommuneVariant,
      );
      return { ...communeFields, hours };
    }

    const hours = [...deltaHours];
    if (firstVespers && !hours.some((h) => h.key === "firstVespers")) {
      hours.push(firstVespers);
    }
    return { ...communeFields, hours };
  }

  // Feasts, solemnities, triduum — hour-level compaction only.
  return {
    ...communeFields,
    hours: buildAllCompactHours(
      liturgicalDay, abstractDay, repo, labels, effectiveChoices, true, dayCommuneVariant,
    ),
  };
}
