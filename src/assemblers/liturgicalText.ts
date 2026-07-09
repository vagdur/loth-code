/**
 * Fixed liturgical texts resolved from DataRepository (data/{locale}/fixed_texts.yaml).
 */

import type { DataRepository } from "../data/repository.js";
import type { LiturgicalFlags } from "../types/hours.js";
import type { GospelCanticleKind } from "../types/texts.js";
import {
  alleluiaIntroEndPunct,
  alleluiaIntroTail,
  formatOurFatherHeadingPlain,
  formatTextNotLoaded,
} from "./labels.js";
const FALLBACK = {
  intro: "℣. O God, come to our aid.\n℟. O Lord, make haste to help us.",
  invitatory: "℣. Lord, open our lips.\n℟. And our mouth shall proclaim your praise.",
  gospel: "[Gospel canticle — text not loaded]",
  teDeum: "[Te Deum — text not loaded]",
  lordsPrayer: "[Our Father — text not loaded]",
  complineResp: "[Compline responsory — text not loaded]",
  complineBless: "[Compline blessing — text not loaded]",
  oorAcclaim: "℣. Let us praise the Lord.\n℟. Thanks be to God.",
  dismissal: "Go in the peace of Christ.\nThanks be to God.",
  examination: "[Examination of conscience]",
};

export function formatIntroductoryVersePlain(
  repo: DataRepository,
  flags: LiturgicalFlags,
): string {
  const fixed = repo.getFixedTexts()?.introductoryVerse;
  if (!fixed) return FALLBACK.intro;
  const endPunct = alleluiaIntroEndPunct(repo, flags);
  const tail = alleluiaIntroTail(repo, flags);
  const v = repo.getAssemblerLabels().rubrics.versicleSymbol;
  const r = repo.getAssemblerLabels().rubrics.responseSymbol;
  return `${v} ${fixed.opening}${endPunct}\n${r} ${fixed.response}${endPunct}\n${fixed.gloria.trim()}${tail}`;
}

export function formatInvitatoryVersePlain(repo: DataRepository): string {
  const fixed = repo.getFixedTexts()?.invitatoryVerse;
  if (!fixed) return FALLBACK.invitatory;
  const v = repo.getAssemblerLabels().rubrics.versicleSymbol;
  const r = repo.getAssemblerLabels().rubrics.responseSymbol;
  return `${v} ${fixed.opening}\n${r} ${fixed.response}`;
}

export function formatGospelCanticlePlain(
  repo: DataRepository,
  kind: GospelCanticleKind,
): string {
  const canticle = repo.getGospelCanticle(kind);
  if (!canticle) return FALLBACK.gospel;
  return `${canticle.reference}\n\n${canticle.text}`;
}

export function formatTeDeumPlain(repo: DataRepository): string {
  return repo.getTeDeum()?.text ?? FALLBACK.teDeum;
}

export function formatLordsPrayerPlain(repo: DataRepository): string {
  const text = repo.getFixedTexts()?.lordsPrayer ?? FALLBACK.lordsPrayer;
  return `${formatOurFatherHeadingPlain(repo)}\n\n${text}`;
}

/** The structured compline responsory, or undefined when fixed texts are absent. */
export function getComplineResponsory(repo: DataRepository) {
  return repo.getFixedTexts()?.complineResponsory;
}

export function formatComplineResponsoryFallbackPlain(): string {
  return FALLBACK.complineResp;
}

export function formatComplineBlessingPlain(repo: DataRepository): string {
  return repo.getFixedTexts()?.complineBlessing?.trim() ?? FALLBACK.complineBless;
}

export function formatOorAcclamationPlain(repo: DataRepository): string {
  return repo.getFixedTexts()?.oorAcclamation?.trim() ?? FALLBACK.oorAcclaim;
}

export function formatDismissalPlain(repo: DataRepository): string {
  const d = repo.getFixedTexts()?.dismissalWithoutMinister;
  if (!d) return FALLBACK.dismissal;
  return `${d.verse}\n${d.response}`;
}

export function formatExaminationOfConsciencePlain(repo: DataRepository): string {
  return repo.getFixedTexts()?.examinationOfConscience ?? FALLBACK.examination;
}

/** Placeholder psalm id when proper psalm/canticle identity is not yet sourced. */
export const PSALM_UNASSIGNED = "psalm_unassigned";

export function resolvePsalmText(id: string, repo: DataRepository): string {
  if (id === PSALM_UNASSIGNED) return "";
  const psalm = repo.getPsalm(id);
  if (psalm) return psalm.verses.map((v) => `${v.number}. ${v.text}`).join("\n");
  const canticle = repo.getCanticle(id);
  if (canticle) return canticle.verses.map((v) => `${v.number}. ${v.text}`).join("\n");
  return formatTextNotLoaded(repo, id);
}
