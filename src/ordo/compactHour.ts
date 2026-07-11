/**
 * Compact Swedish prose for one Hour — baseline + delta style.
 */

import type { OrdoLabels } from "../types/texts.js";
import type { PsalterWeek, Weekday } from "../types/psalter.js";
import type { DescribedSource } from "./sourceLabels.js";
import { sourceGroupOrder } from "./sourceLabels.js";

export interface SlotEntry {
  slotKey: string;
  partLabel: string;
  described: DescribedSource;
}

function capitalizeFirst(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatPartList(parts: string[], andWord: string): string {
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0]!;
  if (parts.length === 2) return `${parts[0]} ${andWord} ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, ${andWord} ${parts[parts.length - 1]}`;
}

function groupEntries(entries: SlotEntry[]): Map<string, SlotEntry[]> {
  const groups = new Map<string, SlotEntry[]>();
  for (const e of entries) {
    const list = groups.get(e.described.groupKey) ?? [];
    list.push(e);
    groups.set(e.described.groupKey, list);
  }
  return groups;
}

export function communeName(phrase: string, labels: OrdoLabels): string | null {
  const prefix = `${labels.sources.communePrefix} (`;
  if (!phrase.startsWith(prefix) || !phrase.endsWith(")")) return null;
  return phrase.slice(prefix.length, -1);
}

interface ProseContext {
  dayCommuneVariant?: string;
  feriaPsalter?: { week: PsalterWeek; day: Weekday };
  psalterBaseline?: "feria" | "sunday";
}

function proseContextFromOpts(opts?: CompactHourOptions): ProseContext {
  const ctx: ProseContext = {
    psalterBaseline: opts?.psalterBaseline ?? "feria",
  };
  if (opts?.dayCommuneVariant) ctx.dayCommuneVariant = opts.dayCommuneVariant;
  if (opts?.feriaPsalter) ctx.feriaPsalter = opts.feriaPsalter;
  return ctx;
}

function isCurrentPsalter(groupKey: string, ctx: ProseContext): boolean {
  if (!ctx.feriaPsalter) return false;
  const { week, day } = ctx.feriaPsalter;
  return groupKey === `psalter:${week}:${day}`;
}

function psalterBaselinePhrase(
  labels: OrdoLabels,
  baseline: "feria" | "sunday",
): string {
  return baseline === "sunday"
    ? (labels.weekdaysDefinite.Sunday ?? "söndagen")
    : labels.sources.feria;
}

function psalterBaselineClause(
  labels: OrdoLabels,
  baseline: "feria" | "sunday",
): string {
  return baseline === "sunday"
    ? labels.prose.allFromSunday
    : labels.prose.allFromFeria;
}

function phraseForProse(
  described: DescribedSource,
  labels: OrdoLabels,
  ctx: ProseContext,
): string {
  const { phrase, groupKey } = described;
  if (isCurrentPsalter(groupKey, ctx)) {
    return psalterBaselinePhrase(labels, ctx.psalterBaseline ?? "feria");
  }
  if (!ctx.dayCommuneVariant) return phrase;
  const commune = communeName(phrase, labels);
  if (commune === ctx.dayCommuneVariant) return labels.sources.communePrefix;
  return phrase;
}

function allFromClause(
  described: DescribedSource,
  labels: OrdoLabels,
  ctx: ProseContext,
): string {
  const { phrase, groupKey } = described;
  if (phrase === labels.sources.propriet) return labels.prose.allFromPropriet;
  const commune = communeName(phrase, labels);
  if (commune) {
    if (ctx.dayCommuneVariant && commune === ctx.dayCommuneVariant) {
      return `Allt från ${labels.sources.communePrefix}.`;
    }
    return labels.prose.allFromCommune.replace("{name}", commune);
  }
  if (isCurrentPsalter(groupKey, ctx)) {
    return psalterBaselineClause(labels, ctx.psalterBaseline ?? "feria");
  }
  if (phrase.startsWith(`${labels.sources.psalterPrefix} `)) {
    return labels.prose.allFromPsalter.replace("{source}", phrase);
  }
  return `Allt ${labels.prose.from} ${phrase}.`;
}

function shortFromClause(described: DescribedSource, labels: OrdoLabels): string {
  return `${capitalizeFirst(described.phrase)}.`;
}

function readingsRestClauses(
  readingEntries: SlotEntry[],
  otherEntries: SlotEntry[],
  labels: OrdoLabels,
  ctx: ProseContext,
): string {
  const readingPhrase = phraseForProse(readingEntries[0]!.described, labels, ctx);
  const otherGroups = groupEntries(otherEntries);
  const otherKey = [...otherGroups.keys()].sort(
    (a, b) => sourceGroupOrder(a) - sourceGroupOrder(b),
  )[0]!;
  const otherPhrase = phraseForProse(
    otherGroups.get(otherKey)![0]!.described, labels, ctx,
  );
  return `${labels.prose.readingsFrom} ${readingPhrase}. ${labels.prose.restFrom} ${otherPhrase}.`;
}

function dominantGroupKey(
  groups: Map<string, SlotEntry[]>,
  sortedKeys: string[],
): string {
  /** Prefer feria/seasonal/proper over commune when slot counts tie. */
  const priority = (key: string): number => {
    if (key.startsWith("psalter:")) return 50;
    if (key.startsWith("seasonal:")) return 40;
    if (key.startsWith("saint:")) return 30;
    if (key.startsWith("canticle:")) return 20;
    if (key === "fixed") return 10;
    if (key.startsWith("common:")) return 5;
    if (key.startsWith("complementary:")) return 5;
    return 0;
  };

  let best = sortedKeys[0]!;
  let bestCount = -1;
  let bestPriority = -1;
  for (const key of sortedKeys) {
    const count = groups.get(key)!.length;
    const p = priority(key);
    if (count > bestCount || (count === bestCount && p > bestPriority)) {
      best = key;
      bestCount = count;
      bestPriority = p;
    }
  }
  return best;
}

function canUseReadingsRest(entries: SlotEntry[]): boolean {
  const readingEntries = entries.filter((e) => isReadingSlot(e.slotKey));
  if (readingEntries.length === 0) return false;
  const otherEntries = entries.filter((e) => !isReadingSlot(e.slotKey));
  if (otherEntries.length === 0) return false;
  return (
    groupEntries(readingEntries).size === 1 &&
    groupEntries(otherEntries).size === 1
  );
}

function isReadingSlot(slotKey: string): boolean {
  return (
    slotKey === "biblicalReading" ||
    slotKey === "patristicReading" ||
    slotKey === "firstReading" ||
    slotKey === "secondReading"
  );
}

function exceptFromGroups(
  groups: Map<string, SlotEntry[]>,
  sortedKeys: string[],
  labels: OrdoLabels,
  ctx: ProseContext,
): string {
  const dominantKey = dominantGroupKey(groups, sortedKeys);
  const others = new Map(
    sortedKeys.filter((k) => k !== dominantKey).map((k) => [k, groups.get(k)!]),
  );
  return exceptClause(groups.get(dominantKey)![0]!.described, others, labels, ctx);
}

function exceptClause(
  dominant: DescribedSource,
  others: Map<string, SlotEntry[]>,
  labels: OrdoLabels,
  ctx: ProseContext,
): string {
  const dominantClause = allFromClause(dominant, labels, ctx).replace(/\.$/, "");
  const exceptParts: string[] = [];
  for (const [, groupEntries] of others) {
    const parts = [...new Set(groupEntries.map((e) => e.partLabel))];
    const phrase = phraseForProse(groupEntries[0]!.described, labels, ctx);
    exceptParts.push(
      `${formatPartList(parts, labels.prose.and)} ${labels.prose.from} ${phrase}`,
    );
  }
  return `${dominantClause} ${labels.prose.except} ${exceptParts.join(` ${labels.prose.and} `)}.`;
}

function filterInvitatoryBaseline(entries: SlotEntry[]): SlotEntry[] {
  const hasNonPsalm = entries.some((e) => !e.described.groupKey.startsWith("psalm:"));
  if (!hasNonPsalm) return entries;
  return entries.filter((e) => !e.described.groupKey.startsWith("psalm:"));
}

function twoPsalterExceptClause(
  groups: Map<string, SlotEntry[]>,
  sortedKeys: [string, string],
  labels: OrdoLabels,
  ctx: ProseContext,
): string {
  const [k1, k2] = sortedKeys;
  const count1 = groups.get(k1)!.length;
  const count2 = groups.get(k2)!.length;
  const [dominantKey, otherKey] = count1 >= count2 ? [k1, k2] : [k2, k1];
  const dominant = groups.get(dominantKey)![0]!.described;
  const other = groups.get(otherKey)!;
  const parts = [...new Set(other.map((e) => e.partLabel))];
  const dominantClause = allFromClause(dominant, labels, ctx).replace(/\.$/, "");
  const otherPhrase = phraseForProse(other[0]!.described, labels, ctx);
  return `${dominantClause} ${labels.prose.except} ${formatPartList(parts, labels.prose.and)} ${labels.prose.from} ${otherPhrase}.`;
}

export interface CompactHourOptions {
  /** Append e.g. "Te Deum." when set. */
  suffix?: string;
  /** OoR with readings vs psalter split uses semantic labels. */
  hourKey?: string;
  /** When set, commune variant name is omitted from hour prose (shown at day level). */
  dayCommuneVariant?: string;
  /** Psalter week/day for the calendar date — current psalter sources collapse to feria. */
  feriaPsalter?: { week: PsalterWeek; day: Weekday };
  /** Baseline label when collapsing the current psalter (feria vs Sunday). */
  psalterBaseline?: "feria" | "sunday";
}

/** Unique commune variant when one variant appears in two or more hours, else null. */
export function dayCommuneVariantFromHourEntryLists(
  hourEntryLists: SlotEntry[][],
  labels: OrdoLabels,
): string | null {
  const variants = new Set<string>();
  let hoursWithCommune = 0;
  for (const entries of hourEntryLists) {
    let hourHasCommune = false;
    for (const e of entries) {
      if (!e.described.groupKey.startsWith("common:")) continue;
      const name = communeName(e.described.phrase, labels);
      if (name) {
        variants.add(name);
        hourHasCommune = true;
      }
    }
    if (hourHasCommune) hoursWithCommune += 1;
  }
  if (variants.size === 1 && hoursWithCommune >= 2) return [...variants][0]!;
  return null;
}

/**
 * Build compact hour prose from resolved slot entries.
 */
export function compactHourProse(
  entries: SlotEntry[],
  labels: OrdoLabels,
  opts?: CompactHourOptions,
): string {
  let filtered = entries;
  if (opts?.hourKey === "invitatory") {
    filtered = filterInvitatoryBaseline(entries);
  }
  if (filtered.length === 0) {
    return opts?.suffix?.trim() ?? "";
  }

  const groups = groupEntries(filtered);
  const sortedKeys = [...groups.keys()].sort(
    (a, b) => sourceGroupOrder(a) - sourceGroupOrder(b),
  );

  let prose: string;

  const ctx = proseContextFromOpts(opts);

  if (sortedKeys.length === 1) {
    prose = allFromClause(
      groups.get(sortedKeys[0]!)![0]!.described, labels, ctx,
    );
  } else if (
    sortedKeys.length === 2 &&
    sortedKeys.every((k) => k.startsWith("psalter:"))
  ) {
    prose = twoPsalterExceptClause(
      groups,
      [sortedKeys[0]!, sortedKeys[1]!],
      labels,
      ctx,
    );
  } else if (opts?.hourKey === "officeOfReadings" && canUseReadingsRest(filtered)) {
    const readingEntries = filtered.filter((e) => isReadingSlot(e.slotKey));
    const otherEntries = filtered.filter((e) => !isReadingSlot(e.slotKey));
    prose = readingsRestClauses(readingEntries, otherEntries, labels, ctx);
  } else {
    prose = exceptFromGroups(groups, sortedKeys, labels, ctx);
  }

  if (opts?.suffix) {
    prose = prose ? `${prose} ${opts.suffix}` : opts.suffix;
  }
  return prose;
}

/** True when two hour entry sets resolve to the same source groups per slot. */
export function hourEntriesEquivalent(a: SlotEntry[], b: SlotEntry[]): boolean {
  if (a.length !== b.length) return false;
  const aKeys = a.map((e) => `${e.slotKey}:${e.described.groupKey}`).sort();
  const bKeys = b.map((e) => `${e.slotKey}:${e.described.groupKey}`).sort();
  return aKeys.every((k, i) => k === bKeys[i]);
}

export { groupEntries, shortFromClause, allFromClause };
