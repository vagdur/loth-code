import type { DataRepository } from "../data/repository.js";
import type { SlotSourceDirect } from "../types/hours.js";
import type { OrdoLabels } from "../types/texts.js";
import { applyTemplate } from "./ordinals.js";
import type { PsalterWeek, Weekday } from "../types/psalter.js";

/** Stable key for grouping parts by source in prose. */
export type SourceGroupKey = string;

export interface DescribedSource {
  groupKey: SourceGroupKey;
  /** Short phrase in the locale, e.g. "proprium", "commune (läkare)", "psaltaret vecka II lördag". */
  phrase: string;
  /** True when this is saint/seasonal proper (not commune/psalter). */
  isProper: boolean;
}

function psalterPhrase(
  week: PsalterWeek,
  day: Weekday,
  labels: OrdoLabels,
): string {
  if (week === 1 && day === "Sunday") {
    return labels.sources.sundayWeekI;
  }
  const dayName = labels.weekdays[day] ?? day;
  // "psaltaret vecka 2 lördag" / "the psalter week 2 Saturday" — word order and
  // the word for "week" are the locale's, so the whole phrase is a template.
  return applyTemplate(
    labels.sources.psalterWeekDay ?? "{psalter} vecka {week} {day}",
    { psalter: labels.sources.psalterPrefix, week: String(week), day: dayName },
  );
}

export function sourceGroupKey(s: SlotSourceDirect): SourceGroupKey {
  switch (s.kind) {
    case "saint":
      return `saint:${s.id}`;
    case "seasonal":
      return `seasonal:${s.key}`;
    case "common":
      return `common:${s.type}:${s.variant}`;
    case "psalter":
      return `psalter:${s.week}:${s.day}`;
    case "fixed":
      return "fixed";
    case "complementary":
      return `complementary:${s.groupId}:${s.index}`;
    case "psalm":
      return `psalm:${s.id}`;
    case "canticle":
      return `canticle:${s.id}`;
  }
}

export function describeSource(
  s: SlotSourceDirect,
  repo: DataRepository,
  labels: OrdoLabels,
): DescribedSource {
  switch (s.kind) {
    case "saint":
      return {
        groupKey: sourceGroupKey(s),
        phrase: labels.sources.propriet,
        isProper: true,
      };
    case "seasonal":
      return {
        groupKey: sourceGroupKey(s),
        phrase: labels.sources.seasonalPropriet,
        isProper: true,
      };
    case "common": {
      const variantLabel = repo.resolve({
        kind: "common",
        type: s.type,
        variant: s.variant,
        field: "label",
      });
      const name = typeof variantLabel === "string" ? variantLabel : s.type;
      return {
        groupKey: sourceGroupKey(s),
        phrase: `${labels.sources.communeInline} (${name})`,
        isProper: false,
      };
    }
    case "psalter":
      return {
        groupKey: sourceGroupKey(s),
        phrase: psalterPhrase(s.week, s.day, labels),
        isProper: false,
      };
    case "fixed":
      return {
        groupKey: sourceGroupKey(s),
        phrase: labels.sources.fixed,
        isProper: false,
      };
    case "complementary":
      return {
        groupKey: sourceGroupKey(s),
        phrase: labels.sources.complementaryPsalmody,
        isProper: false,
      };
    case "psalm":
      return {
        groupKey: sourceGroupKey(s),
        phrase: `psalm ${s.id.replace(/^psalm_/, "")}`,
        isProper: false,
      };
    case "canticle":
      return {
        groupKey: sourceGroupKey(s),
        phrase: s.id.replace(/_/g, " "),
        isProper: false,
      };
  }
}

/** Order for grouping clauses in hour prose. */
export function sourceGroupOrder(key: SourceGroupKey): number {
  if (key.startsWith("saint:")) return 0;
  if (key.startsWith("seasonal:")) return 1;
  if (key.startsWith("common:")) return 2;
  if (key.startsWith("psalter:")) return 3;
  if (key.startsWith("complementary:")) return 4;
  if (key === "fixed") return 5;
  return 6;
}
