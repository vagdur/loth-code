/**
 * Assembler presentation labels from fixed_texts.yaml (labels section).
 */

import type { DataRepository } from "../data/repository.js";
import type { LiturgicalFlags } from "../types/hours.js";
import type { Antiphon, AssemblerLabels } from "../types/texts.js";

export type HourLabelKey = keyof AssemblerLabels["hours"];
export type SectionLabelKey = keyof AssemblerLabels["sections"];

export function getLabels(repo: DataRepository): AssemblerLabels {
  return repo.getAssemblerLabels();
}

export function getAlleluiaText(repo: DataRepository): string {
  return repo.getFixedTexts()?.alleluia ?? "Alleluia.";
}

/** Eastertide suffix appended after antiphon text (includes leading space). */
export function alleluiaAntiphonSuffix(
  repo: DataRepository,
  flags: LiturgicalFlags,
  suppressAlleluia?: boolean,
): string {
  if (!flags.alleluiaInAntiphons || suppressAlleluia) return "";
  return ` ${getAlleluiaText(repo)}`;
}

/** Eastertide punctuation after intro verse opening/response. */
export function alleluiaIntroEndPunct(
  repo: DataRepository,
  flags: LiturgicalFlags,
): string {
  return flags.alleluiaInIntroVerse
    ? getLabels(repo).rubrics.alleluiaIntroSuffix
    : ".";
}

/** Eastertide trailing alleluia after Gloria in intro verse. */
export function alleluiaIntroTail(
  repo: DataRepository,
  flags: LiturgicalFlags,
): string {
  return flags.alleluiaInIntroVerse ? ` ${getAlleluiaText(repo)}` : "";
}

export function formatAntiphonPlain(
  repo: DataRepository,
  a: Antiphon,
  flags: LiturgicalFlags,
): string {
  const prefix = getLabels(repo).rubrics.antiphonPrefix;
  return `${prefix} ${a.text}${alleluiaAntiphonSuffix(repo, flags, a.suppressAlleluia)}`;
}

/** GILH §53 — no Orémus after the Lord's Prayer at Lauds or Vespers. */
export function includesLetUsPrayRubric(
  hour: HourLabelKey | "firstVespers",
): boolean {
  return hour !== "lauds" && hour !== "vespers" && hour !== "firstVespers";
}

export function formatConcludingPrayerPlain(
  repo: DataRepository,
  text: string,
  hour: HourLabelKey | "firstVespers",
): string {
  if (!includesLetUsPrayRubric(hour)) return text;
  return `${getLabels(repo).rubrics.letUsPray}\n\n${text}`;
}

export function formatOurFatherHeadingPlain(repo: DataRepository): string {
  const title = getLabels(repo).sections.ourFather;
  const pad = Math.max(0, 40 - title.length);
  return `── ${title} ${"─".repeat(pad)}`;
}

export function formatVersicleLinePlain(
  repo: DataRepository,
  verse: string,
): string {
  return `${getLabels(repo).rubrics.versicleSymbol} ${verse}`;
}

export function formatResponseLinePlain(
  repo: DataRepository,
  response: string,
): string {
  return `${getLabels(repo).rubrics.responseSymbol} ${response}`;
}

export function formatTextNotLoaded(repo: DataRepository, id: string): string {
  const template =
    getLabels(repo).errors?.textNotLoaded ?? "[{id} — text not loaded]";
  return template.replace("{id}", id);
}

export function plainHeading(text: string): string {
  const bar = "═".repeat(text.length + 4);
  return `${bar}\n  ${text}\n${bar}`;
}

export function plainSubheading(text: string): string {
  return `── ${text} ${"─".repeat(Math.max(0, 40 - text.length))}`;
}

export function hourHeadingPlain(repo: DataRepository, key: HourLabelKey): string {
  return plainHeading(getLabels(repo).hours[key]);
}

export function sectionHeadingPlain(
  repo: DataRepository,
  key: SectionLabelKey,
): string {
  return plainSubheading(getLabels(repo).sections[key]);
}
