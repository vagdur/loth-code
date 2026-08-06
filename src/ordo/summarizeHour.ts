/**
 * Group resolved slot sources into Swedish prose for one Hour.
 */

import type { DataRepository } from "../data/repository.js";
import type { LiturgicalDay } from "../types/calendar.js";
import type {
  AbstractDaytimePrayer, AbstractInvitatory,
  AbstractLauds, AbstractOfficeOfReadings, AbstractVespers,
} from "../types/hours.js";
import { summarizeComplineLabel } from "./complineLabel.js";
import type { OrdoLabels } from "../types/texts.js";
import type { DayChoices } from "../types/options.js";
import { resolveEffectiveSource } from "./resolveEffective.js";
import {
  describeSource, sourceGroupKey, sourceGroupOrder,
  type DescribedSource,
} from "./sourceLabels.js";
import { partLabelForSlotKey } from "./partLabels.js";
import type { SlotEntry } from "./compactHour.js";

type HourLike =
  | AbstractInvitatory
  | AbstractOfficeOfReadings
  | AbstractLauds
  | AbstractDaytimePrayer
  | AbstractVespers;

function formatPartList(parts: string[], andWord: string): string {
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0]!;
  if (parts.length === 2) return `${parts[0]} ${andWord} ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, ${andWord} ${parts[parts.length - 1]}`;
}

function capitalizeFirst(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

type SlotPair = [string, import("../types/hours.js").SlotSource | null | undefined];

function resolveSlot(
  hourKey: string,
  slotKey: string,
  source: import("../types/hours.js").SlotSource | null | undefined,
  repo: DataRepository,
  labels: OrdoLabels,
  choices?: DayChoices,
): SlotEntry | null {
  if (!source) return null;
  const partLabel = partLabelForSlotKey(slotKey, labels);
  if (!partLabel) return null;
  const path = `${hourKey}.${slotKey}`;
  const effective = resolveEffectiveSource(source, repo, {
    ...(choices ? { choices } : {}),
    optionPath: path,
  });
  if (!effective) return null;
  const alternatives = effective.alternatives?.map((s) =>
    describeSource(s, repo, labels),
  );
  return {
    slotKey,
    // Now that the winner is known, the label can name the part it really is:
    // a slot the rubrics fix by psalm contributes psalms, not antiphons.
    partLabel: partLabelForSlotKey(slotKey, labels, effective.winner) ?? partLabel,
    described: describeSource(effective.winner, repo, labels),
    ...(alternatives?.length ? { alternatives } : {}),
  };
}

function groupEntries(entries: SlotEntry[]): Map<string, SlotEntry[]> {
  const groups = new Map<string, SlotEntry[]>();
  for (const e of entries) {
    const key = e.described.groupKey;
    const list = groups.get(key) ?? [];
    list.push(e);
    groups.set(key, list);
  }
  return groups;
}

function buildClause(
  groupKey: string,
  entries: SlotEntry[],
  labels: OrdoLabels,
): string {
  const described = entries[0]!.described;
  const uniqueParts = [...new Set(entries.map((e) => e.partLabel))];

  // Collapse multiple psalm slots into one antiphons entry + optional psalms.
  const hasPsalmSlots = entries.some((e) => e.slotKey.startsWith("psalmSlots"));
  let parts = uniqueParts;
  if (hasPsalmSlots && uniqueParts.length === 1 && uniqueParts[0] === labels.parts.antiphons) {
    parts = [labels.parts.antiphons, labels.parts.psalms];
  }

  const partList = formatPartList(parts, labels.prose.and);
  return `${capitalizeFirst(partList)} ${labels.prose.from} ${described.phrase}`;
}

function buildProseFromEntries(entries: SlotEntry[], labels: OrdoLabels): string {
  if (entries.length === 0) return "";
  const groups = groupEntries(entries);
  const sortedKeys = [...groups.keys()].sort(
    (a, b) => sourceGroupOrder(a) - sourceGroupOrder(b),
  );
  const clauses = sortedKeys.map((key) => buildClause(key, groups.get(key)!, labels));
  return clauses.map((c) => `${c}.`).join(" ");
}

function collectInvitatorySlots(
  hour: AbstractInvitatory,
  repo: DataRepository,
  labels: OrdoLabels,
  choices?: DayChoices,
): SlotEntry[] {
  const k = "invitatory";
  const out: SlotEntry[] = [];
  const pairs: SlotPair[] = [
    ["antiphon", hour.antiphonRef],
    ["psalm", hour.psalmRef],
  ];
  for (const [slotKey, source] of pairs) {
    const e = resolveSlot(k, slotKey, source, repo, labels, choices);
    if (e) out.push(e);
  }
  return out;
}

function collectOorSlots(
  hour: AbstractOfficeOfReadings,
  repo: DataRepository,
  labels: OrdoLabels,
  choices?: DayChoices,
): SlotEntry[] {
  const k = "officeOfReadings";
  const out: SlotEntry[] = [];
  const pairs: SlotPair[] = [
    ["hymn", hour.hymnRef],
    ...hour.psalmSlots.map((s, i): SlotPair => [`psalmSlots[${i}]`, s.assignmentRef]),
    ["versicle", hour.versicleRef],
    ["biblicalReading", hour.biblicalReadingRef],
    ["patristicReading", hour.patristicReadingRef],
    ["concludingPrayer", hour.concludingPrayerRef],
  ];
  for (const [slotKey, source] of pairs) {
    const e = resolveSlot(k, slotKey, source, repo, labels, choices);
    if (e) out.push(e);
  }
  return out;
}

function collectLaudsSlots(
  hour: AbstractLauds,
  repo: DataRepository,
  labels: OrdoLabels,
  choices?: DayChoices,
): SlotEntry[] {
  const k = "lauds";
  const out: SlotEntry[] = [];
  const pairs: SlotPair[] = [
    ["hymn", hour.hymnRef],
    ...hour.psalmSlots.map((s, i): SlotPair => [`psalmSlots[${i}]`, s.assignmentRef]),
    ["shortReading", hour.shortReadingRef],
    ["shortResponsory", hour.shortResponsoryRef],
    ["benedictusAntiphon", hour.benedictusAntiphonRef],
    ["intercessions", hour.intercessionsRef],
    ["concludingPrayer", hour.concludingPrayerRef],
  ];
  for (const [slotKey, source] of pairs) {
    const e = resolveSlot(k, slotKey, source, repo, labels, choices);
    if (e) out.push(e);
  }
  return out;
}

function collectDaytimeSlots(
  hour: AbstractDaytimePrayer,
  repo: DataRepository,
  labels: OrdoLabels,
  choices?: DayChoices,
): SlotEntry[] {
  const k = hour.kind;
  const out: SlotEntry[] = [];
  const pairs: SlotPair[] = [
    ["hymn", hour.hymnRef],
    ...hour.psalmSlots.map((s, i): SlotPair => [`psalmSlots[${i}]`, s.assignmentRef]),
    ["properAntiphons", hour.properAntiphonsRef],
    ["shortReading", hour.shortReadingRef],
    ["versicle", hour.versicleRef],
    ["concludingPrayer", hour.concludingPrayerRef],
  ];
  for (const [slotKey, source] of pairs) {
    const e = resolveSlot(k, slotKey, source, repo, labels, choices);
    if (e) out.push(e);
  }
  return out;
}

function collectVespersSlots(
  hour: AbstractVespers,
  hourKey: "vespers" | "firstVespers",
  repo: DataRepository,
  labels: OrdoLabels,
  choices?: DayChoices,
): SlotEntry[] {
  const out: SlotEntry[] = [];
  const pairs: SlotPair[] = [
    ["hymn", hour.hymnRef],
    ...hour.psalmSlots.map((s, i): SlotPair => [`psalmSlots[${i}]`, s.assignmentRef]),
    ["shortReading", hour.shortReadingRef],
    ["shortResponsory", hour.shortResponsoryRef],
    ["magnificatAntiphon", hour.magnificatAntiphonRef],
    ["intercessions", hour.intercessionsRef],
    ["concludingPrayer", hour.concludingPrayerRef],
  ];
  for (const [slotKey, source] of pairs) {
    const e = resolveSlot(hourKey, slotKey, source, repo, labels, choices);
    if (e) out.push(e);
  }
  return out;
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

export function summarizeInvitatory(
  hour: AbstractInvitatory,
  repo: DataRepository,
  labels: OrdoLabels,
  choices?: DayChoices,
): string {
  return buildProseFromEntries(collectInvitatorySlots(hour, repo, labels, choices), labels);
}

export function summarizeOfficeOfReadings(
  hour: AbstractOfficeOfReadings,
  repo: DataRepository,
  labels: OrdoLabels,
  choices?: DayChoices,
): string {
  let prose = buildProseFromEntries(collectOorSlots(hour, repo, labels, choices), labels);
  if (hour.flags.teDeum) {
    prose = prose ? `${prose} ${labels.prose.teDeumSaid}` : labels.prose.teDeumSaid;
  }
  return prose;
}

export function summarizeLauds(
  hour: AbstractLauds,
  repo: DataRepository,
  labels: OrdoLabels,
  choices?: DayChoices,
): string {
  return buildProseFromEntries(collectLaudsSlots(hour, repo, labels, choices), labels);
}

export function summarizeDaytime(
  hour: AbstractDaytimePrayer,
  repo: DataRepository,
  labels: OrdoLabels,
  choices?: DayChoices,
): string {
  return buildProseFromEntries(collectDaytimeSlots(hour, repo, labels, choices), labels);
}

export function summarizeVespers(
  hour: AbstractVespers,
  hourKey: "vespers" | "firstVespers",
  repo: DataRepository,
  labels: OrdoLabels,
  choices?: DayChoices,
): string {
  const entries = collectVespersSlots(hour, hourKey, repo, labels, choices);
  if (
    hour.isFirstVespers &&
    hour.liturgicalDay.evening.firstVespersCelebration?.type === "sunday" &&
    isSundayPsalterOnly(entries)
  ) {
    return `${labels.prose.firstVespersForSunday} ${labels.prose.allFromSunday}`;
  }
  return buildProseFromEntries(entries, labels);
}

export function summarizeCompline(day: LiturgicalDay, labels: OrdoLabels): string {
  return summarizeComplineLabel(day, labels);
}

/** Exported for tests — inspect resolved source keys on an hour. */
export function collectHourEntries(
  hour: HourLike,
  hourKey: string,
  repo: DataRepository,
  labels: OrdoLabels,
  choices?: DayChoices,
): SlotEntry[] {
  switch (hour.kind) {
    case "invitatory":
      return collectInvitatorySlots(hour, repo, labels, choices);
    case "office_of_readings":
      return collectOorSlots(hour, repo, labels, choices);
    case "lauds":
      return collectLaudsSlots(hour, repo, labels, choices);
    case "terce":
    case "sext":
    case "none":
      return collectDaytimeSlots(hour, repo, labels, choices);
    case "vespers":
      return collectVespersSlots(hour, hourKey as "vespers" | "firstVespers", repo, labels, choices);
  }
}

export { sourceGroupKey };
