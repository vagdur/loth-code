/**
 * Day-level commune lines from applicable commons or resolved hour sources.
 */

import type { DataRepository } from "../data/repository.js";
import type { Celebration } from "../types/calendar.js";
import type { CommonType } from "../types/proper.js";
import type { OrdoLabels } from "../types/texts.js";
import { dayCommuneVariantFromHourEntryLists, type SlotEntry } from "./compactHour.js";

export function commonTypeLabel(type: CommonType, repo: DataRepository): string {
  const label = repo.resolve({
    kind: "common",
    type,
    variant: 0,
    field: "label",
  });
  return typeof label === "string" ? label : type;
}

/** Join names with "A eller B" / "A, B eller C" (Swedish-style). */
export function joinOr(names: string[], orWord: string): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0]!;
  if (names.length === 2) return `${names[0]} ${orWord} ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} ${orWord} ${names[names.length - 1]}`;
}

export function formatDayCommuneLine(name: string, labels: OrdoLabels): string {
  return (labels.prose.dayCommune ?? "Commune: {name}").replace("{name}", name);
}

export function applicableCommonsLine(
  celebration: Celebration,
  repo: DataRepository,
  labels: OrdoLabels,
): string | undefined {
  const { applicableCommons } = celebration;
  if (applicableCommons.length === 0) return undefined;
  const names = applicableCommons.map((t) => commonTypeLabel(t, repo));
  const orWord = labels.prose.or ?? "eller";
  return formatDayCommuneLine(joinOr(names, orWord), labels);
}

export function memoriaCommuneInfo(
  celebration: Celebration,
  hourEntryLists: SlotEntry[][],
  repo: DataRepository,
  labels: OrdoLabels,
): { line?: string; dayCommuneVariant?: string; dayCommuneVariants?: string[] } {
  const commons = celebration.applicableCommons;
  if (commons.length > 0) {
    const names = commons.map((t) => commonTypeLabel(t, repo));
    const orWord = labels.prose.or ?? "eller";
    const line = formatDayCommuneLine(joinOr(names, orWord), labels);
    if (names.length > 1) {
      return { line, dayCommuneVariants: names };
    }
    return { line, ...(names[0] ? { dayCommuneVariant: names[0] } : {}) };
  }

  const variant = dayCommuneVariantFromHourEntryLists(hourEntryLists, labels);
  if (!variant) return {};
  return {
    line: formatDayCommuneLine(variant, labels),
    dayCommuneVariant: variant,
  };
}
