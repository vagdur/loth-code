/**
 * Fixed liturgical texts resolved from DataRepository (data/{locale}/fixed_texts.yaml).
 */

import type { DataRepository } from "../data/repository.js";
import type { LiturgicalFlags } from "../types/hours.js";
import type { GospelCanticleKind } from "../types/texts.js";
import {
  alleluiaIntroEndPunct,
  alleluiaIntroTail,
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
  
  // New format: render from strophes
  if (canticle.strophes && canticle.strophes.length > 0) {
    const text = renderPsalmodyText({ strophes: canticle.strophes });
    return `${canticle.reference}\n\n${text}`;
  }
  
  // Legacy format: use the text field
  if (canticle.text) {
    return `${canticle.reference}\n\n${canticle.text}`;
  }
  
  return FALLBACK.gospel;
}

export function formatTeDeumPlain(repo: DataRepository): string {
  return repo.getTeDeum()?.text ?? FALLBACK.teDeum;
}

export function formatLordsPrayerPlain(repo: DataRepository): string {
  return repo.getFixedTexts()?.lordsPrayer?.text ?? FALLBACK.lordsPrayer;
}

/** The structured compline responsory, or undefined when fixed texts are absent. */
export function getComplineResponsory(repo: DataRepository) {
  return repo.getFixedTexts()?.complineResponsory;
}

export function formatComplineResponsoryFallbackPlain(): string {
  return FALLBACK.complineResp;
}

export function formatComplineBlessingPlain(repo: DataRepository): string {
  return repo.getFixedTexts()?.complineBlessing?.text?.trim() ?? FALLBACK.complineBless;
}

export function formatOorAcclamationPlain(repo: DataRepository): string {
  return repo.getFixedTexts()?.oorAcclamation?.text?.trim() ?? FALLBACK.oorAcclaim;
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

/**
 * Strip U+0301 combining acute accent for plain text (the stress accents are
 * presentation only; keep the base letter).
 */
function stripAccents(text: string): string {
  return text.replace(/\u0301/g, "");
}

/**
 * Render a PsalmodyText (new strophe structure) as plain text: one line per
 * colon, with verse numbers on the cola that carry `n`, and † / * after cola
 * that have `end`. Accents are stripped for plain text; strophe breaks produce
 * extra spacing (via blank lines).
 */
function renderPsalmodyText(psalmodyText: { strophes: { verses: { text: string; end?: "flex" | "mediant"; n?: number }[][] }[] }): string {
  const stropheLines = psalmodyText.strophes.map((strophe) => {
    const verseLines = strophe.verses.map((sungVerse) => {
      const colonLines = sungVerse.map((colon) => {
        const num = colon.n != null ? `${colon.n}. ` : "";
        const text = stripAccents(colon.text);
        const marker = colon.end === "flex" ? " †" : colon.end === "mediant" ? " *" : "";
        return `${num}${text}${marker}`;
      });
      return colonLines.join("\n");
    });
    return verseLines.join("\n");
  });
  return stropheLines.join("\n\n");
}

/**
 * Render legacy verses (backward compatibility for locales that haven't
 * converted yet): wrap as one strophe of one-colon verses with no markers.
 */
function renderLegacyVerses(verses: { number: number; text: string }[]): string {
  return verses.map((v) => `${v.number}. ${v.text}`).join("\n");
}

export function resolvePsalmText(id: string, repo: DataRepository): string {
  if (id === PSALM_UNASSIGNED) return "";
  const psalm = repo.getPsalm(id);
  if (psalm) {
    // New format
    if (psalm.strophes && psalm.strophes.length > 0) {
      return renderPsalmodyText(psalm);
    }
    // Legacy format
    if (psalm.verses && psalm.verses.length > 0) {
      return renderLegacyVerses(psalm.verses);
    }
    return "";
  }
  const canticle = repo.getCanticle(id);
  if (canticle) {
    // New format
    if (canticle.strophes && canticle.strophes.length > 0) {
      return renderPsalmodyText(canticle);
    }
    // Legacy format
    if (canticle.verses && canticle.verses.length > 0) {
      return renderLegacyVerses(canticle.verses);
    }
    return "";
  }
  return formatTextNotLoaded(repo, id);
}
