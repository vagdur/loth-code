/**
 * Compact Swedish prose for one Hour — positive listing style.
 */

import type { OrdoLabels } from "../types/texts.js";
import type { PsalterWeek, Weekday } from "../types/psalter.js";
import type { DescribedSource } from "./sourceLabels.js";
import { sourceGroupOrder } from "./sourceLabels.js";

export interface SlotEntry {
  slotKey: string;
  partLabel: string;
  described: DescribedSource;
  /** Ad-lib tail sources that also resolve (for option annotation). */
  alternatives?: DescribedSource[];
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
  const prefix = `${labels.sources.communeInline} (`;
  if (!phrase.startsWith(prefix) || !phrase.endsWith(")")) return null;
  return phrase.slice(prefix.length, -1);
}

interface ProseContext {
  dayCommuneVariant?: string;
  dayCommuneVariants?: string[];
  feriaPsalter?: { week: PsalterWeek; day: Weekday };
  psalterBaseline?: "feria" | "sunday";
}

function proseContextFromOpts(opts?: CompactHourOptions): ProseContext {
  const ctx: ProseContext = {
    psalterBaseline: opts?.psalterBaseline ?? "feria",
  };
  if (opts?.dayCommuneVariant) ctx.dayCommuneVariant = opts.dayCommuneVariant;
  if (opts?.dayCommuneVariants?.length) ctx.dayCommuneVariants = opts.dayCommuneVariants;
  if (opts?.feriaPsalter) ctx.feriaPsalter = opts.feriaPsalter;
  return ctx;
}

function communeInDayContext(commune: string, ctx: ProseContext): boolean {
  if (ctx.dayCommuneVariants?.includes(commune)) return true;
  return ctx.dayCommuneVariant === commune;
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
  if (!ctx.dayCommuneVariant && !ctx.dayCommuneVariants?.length) return phrase;
  const commune = communeName(phrase, labels);
  if (commune && communeInDayContext(commune, ctx)) return labels.sources.communeInline;
  return phrase;
}

function dedupeSourcePhrases(phrases: string[], labels: OrdoLabels): string[] {
  const normalized = phrases.map((p) => {
    if (p === labels.sources.communeInline) return p;
    if (communeName(p, labels)) return labels.sources.communeInline;
    return p;
  });
  return [...new Set(normalized)];
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
    if (communeInDayContext(commune, ctx)) {
      return `Allt från ${labels.sources.communeInline}.`;
    }
    return labels.prose.allFromCommune
      .replace("{commune}", labels.sources.communeInline)
      .replace("{name}", commune);
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

function matchesBaseline(
  entry: SlotEntry,
  baselineKey: string,
  ctx: ProseContext,
): boolean {
  const key = entry.described.groupKey;
  if (key === baselineKey) return true;
  if (isCurrentPsalter(baselineKey, ctx) && isCurrentPsalter(key, ctx)) return true;
  return false;
}

function hasBaselineAlternative(
  entry: SlotEntry,
  baselineKey: string,
  ctx: ProseContext,
): boolean {
  if (!entry.alternatives?.length) return false;
  return entry.alternatives.some(
    (alt) =>
      alt.groupKey === baselineKey ||
      (isCurrentPsalter(baselineKey, ctx) && isCurrentPsalter(alt.groupKey, ctx)),
  );
}

function positiveReadingsRestClauses(
  readingEntries: SlotEntry[],
  otherEntries: SlotEntry[],
  labels: OrdoLabels,
  ctx: ProseContext,
  baselineKey: string,
): string {
  const clauses: string[] = [];
  const readingDeviations = readingEntries.filter(
    (e) => !matchesBaseline(e, baselineKey, ctx),
  );
  const otherDeviations = otherEntries.filter(
    (e) => !matchesBaseline(e, baselineKey, ctx),
  );
  clauses.push(
    ...buildPositiveClauses(readingDeviations, labels, ctx, baselineKey),
  );
  clauses.push(
    ...buildPositiveClauses(otherDeviations, labels, ctx, baselineKey),
  );
  return clauses.join(" ");
}

interface ClauseGroup {
  kind: "fixed" | "optional";
  parts: string[];
  /** Fixed: single source phrase. Optional: non-baseline phrases then baseline. */
  sourcePhrases: string[];
  baselinePhrase?: string;
  firstIndex: number;
}

function clauseGroupKey(group: ClauseGroup): string {
  if (group.kind === "fixed") {
    return `fixed:${group.sourcePhrases[0]}`;
  }
  return `optional:${group.sourcePhrases.join("|")}:${group.baselinePhrase}`;
}

function buildPositiveClauses(
  deviations: SlotEntry[],
  labels: OrdoLabels,
  ctx: ProseContext,
  baselineKey: string,
): string[] {
  const baselinePhrase = phraseForProse(
    deviations.find((e) => matchesBaseline(e, baselineKey, ctx))?.described ??
      {
        groupKey: baselineKey,
        phrase: psalterBaselinePhrase(labels, ctx.psalterBaseline ?? "feria"),
        isProper: false,
      },
    labels,
    ctx,
  );

  const groups = new Map<string, ClauseGroup>();

  for (let i = 0; i < deviations.length; i++) {
    const entry = deviations[i]!;
    if (matchesBaseline(entry, baselineKey, ctx)) continue;

    const optional = hasBaselineAlternative(entry, baselineKey, ctx);
    const winnerPhrase = phraseForProse(entry.described, labels, ctx);

    if (optional) {
      const altPhrases = dedupeSourcePhrases([
        winnerPhrase,
        ...(entry.alternatives ?? [])
          .filter((alt) => !matchesBaseline({ ...entry, described: alt }, baselineKey, ctx))
          .map((alt) => phraseForProse(alt, labels, ctx)),
      ], labels);
      const nonBaseline = altPhrases.filter((p) => p !== baselinePhrase);
      const group: ClauseGroup = {
        kind: "optional",
        parts: [entry.partLabel],
        sourcePhrases: nonBaseline.length > 0 ? nonBaseline : [winnerPhrase],
        baselinePhrase,
        firstIndex: i,
      };
      const key = clauseGroupKey(group);
      const existing = groups.get(key);
      if (existing) {
        existing.parts.push(entry.partLabel);
      } else {
        groups.set(key, group);
      }
    } else {
      const group: ClauseGroup = {
        kind: "fixed",
        parts: [entry.partLabel],
        sourcePhrases: [winnerPhrase],
        firstIndex: i,
      };
      const key = clauseGroupKey(group);
      const existing = groups.get(key);
      if (existing) {
        existing.parts.push(entry.partLabel);
      } else {
        groups.set(key, group);
      }
    }
  }

  const fromUr = labels.prose.fromUr ?? "ur";
  const orWord = labels.prose.or ?? "eller";

  return [...groups.values()]
    .sort((a, b) => a.firstIndex - b.firstIndex)
    .map((group) => {
      const partList = capitalizeFirst(
        formatPartList([...new Set(group.parts)], labels.prose.and),
      );
      if (group.kind === "fixed") {
        return `${partList} ${fromUr} ${group.sourcePhrases[0]}.`;
      }
      const nonBaseline = group.sourcePhrases;
      const baseline = group.baselinePhrase!;
      if (nonBaseline.length === 1) {
        return `${partList} ${labels.prose.from} ${nonBaseline[0]} ${orWord} ${baseline}.`;
      }
      const listed = formatPartList(nonBaseline, labels.prose.and);
      return `${partList} ${labels.prose.from} ${listed} ${orWord} ${baseline}.`;
    });
}

function positiveHourProse(
  entries: SlotEntry[],
  labels: OrdoLabels,
  ctx: ProseContext,
  opts?: CompactHourOptions,
): string {
  const groups = groupEntries(entries);
  const sortedKeys = [...groups.keys()].sort(
    (a, b) => sourceGroupOrder(a) - sourceGroupOrder(b),
  );

  if (sortedKeys.length === 1) {
    return allFromClause(
      groups.get(sortedKeys[0]!)![0]!.described, labels, ctx,
    );
  }

  if (
    sortedKeys.length === 2 &&
    sortedKeys.every((k) => k.startsWith("psalter:"))
  ) {
    const baselineKey = dominantGroupKey(groups, sortedKeys);
    const deviations = entries.filter(
      (e) => !matchesBaseline(e, baselineKey, ctx),
    );
    const clauses = buildPositiveClauses(deviations, labels, ctx, baselineKey);
    return clauses.join(" ") || allFromClause(
      groups.get(baselineKey)![0]!.described, labels, ctx,
    );
  }

  if (opts?.hourKey === "officeOfReadings" && canUseReadingsRest(entries)) {
    const baselineKey = dominantGroupKey(groups, sortedKeys);
    const readingEntries = entries.filter((e) => isReadingSlot(e.slotKey));
    const otherEntries = entries.filter((e) => !isReadingSlot(e.slotKey));
    return positiveReadingsRestClauses(
      readingEntries, otherEntries, labels, ctx, baselineKey,
    );
  }

  const baselineKey = dominantGroupKey(groups, sortedKeys);
  const deviations = entries.filter(
    (e) => !matchesBaseline(e, baselineKey, ctx),
  );
  if (deviations.length === 0) {
    return allFromClause(
      groups.get(baselineKey)![0]!.described, labels, ctx,
    );
  }
  return buildPositiveClauses(deviations, labels, ctx, baselineKey).join(" ");
}

function filterInvitatoryBaseline(entries: SlotEntry[]): SlotEntry[] {
  const hasNonPsalm = entries.some((e) => !e.described.groupKey.startsWith("psalm:"));
  if (!hasNonPsalm) return entries;
  return entries.filter((e) => !e.described.groupKey.startsWith("psalm:"));
}

export interface CompactHourOptions {
  /** Append e.g. "Te Deum." when set. */
  suffix?: string;
  /** OoR with readings vs psalter split uses semantic labels. */
  hourKey?: string;
  /** When set, commune variant name is omitted from hour prose (shown at day level). */
  dayCommuneVariant?: string;
  /** When several commons are ad-lib choices, omit all listed variant names from hour prose. */
  dayCommuneVariants?: string[];
  /** Psalter week/day for the calendar date — current psalter sources collapse to feria. */
  feriaPsalter?: { week: PsalterWeek; day: Weekday };
  /** Baseline label when collapsing the current psalter (feria vs Sunday). */
  psalterBaseline?: "feria" | "sunday";
  /** Ferial hour entries when building memoria delta prose. */
  deltaFerialEntries?: SlotEntry[];
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

  const ctx = proseContextFromOpts(opts);
  let prose = positiveHourProse(filtered, labels, ctx, opts);

  if (opts?.suffix) {
    prose = prose ? `${prose} ${opts.suffix}` : opts.suffix;
  }
  return prose;
}

function psalterBaselineKey(ctx: ProseContext): string {
  if (!ctx.feriaPsalter) return "feria-baseline";
  const { week, day } = ctx.feriaPsalter;
  return `psalter:${week}:${day}`;
}

/**
 * Memoria invitatory antiphon: common or the current ferial day (office-spec §5.4).
 * Seasonal and psalter tail sources both represent the ferial option.
 */
function buildInvitatoryDeltaProse(
  deltaEntries: SlotEntry[],
  ferialEntries: SlotEntry[],
  labels: OrdoLabels,
  ctx: ProseContext,
): string {
  const antiphon = deltaEntries.find((e) => e.slotKey === "antiphon");
  if (!antiphon) {
    return buildPositiveClauses(
      deltaEntries, labels, ctx, psalterBaselineKey(ctx),
    ).join(" ");
  }

  const ferialAntiphon = ferialEntries.find((e) => e.slotKey === "antiphon");
  const ferialBaselineKey = ferialAntiphon?.described.groupKey ?? psalterBaselineKey(ctx);
  const matchesFerial = (described: DescribedSource): boolean =>
    described.groupKey === ferialBaselineKey
    || (ferialBaselineKey.startsWith("seasonal:")
      && isCurrentPsalter(described.groupKey, ctx));

  const winnerPhrase = phraseForProse(antiphon.described, labels, ctx);
  if (antiphon.described.groupKey.startsWith("saint:")) {
    return `${capitalizeFirst(antiphon.partLabel)} ${labels.prose.fromUr} ${winnerPhrase}.`;
  }

  const hasFerialAlternative = antiphon.alternatives?.some(matchesFerial) ?? false;
  if (hasFerialAlternative) {
    return `${capitalizeFirst(antiphon.partLabel)} ${labels.prose.from} ${winnerPhrase} ${labels.prose.or} ${labels.sources.feria}.`;
  }

  return `${capitalizeFirst(antiphon.partLabel)} ${labels.prose.fromUr} ${winnerPhrase}.`;
}

/** Prose for memoria delta hours: list only parts that differ from the ferial baseline. */
export function compactDeltaHourProse(
  deltaEntries: SlotEntry[],
  labels: OrdoLabels,
  opts?: CompactHourOptions,
): string {
  if (deltaEntries.length === 0) {
    return opts?.suffix?.trim() ?? "";
  }
  const ctx = proseContextFromOpts(opts);
  const prose = opts?.hourKey === "invitatory" && opts.deltaFerialEntries
    ? buildInvitatoryDeltaProse(
      deltaEntries, opts.deltaFerialEntries, labels, ctx,
    )
    : buildPositiveClauses(
      deltaEntries, labels, ctx, psalterBaselineKey(ctx),
    ).join(" ");
  if (opts?.suffix) {
    return prose ? `${prose} ${opts.suffix}` : opts.suffix;
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

/** Slots whose resolved source group differs from the ferial baseline. */
export function deltaSlotEntries(
  ferialEntries: SlotEntry[],
  otherEntries: SlotEntry[],
): SlotEntry[] {
  const ferialBySlot = new Map(
    ferialEntries.map((e) => [e.slotKey, e.described.groupKey]),
  );
  return otherEntries.filter(
    (e) => ferialBySlot.get(e.slotKey) !== e.described.groupKey,
  );
}

export { groupEntries, shortFromClause, allFromClause };
