/**
 * Fixed liturgical texts resolved from DataRepository (data/fixed_texts.yaml).
 */

import type { DataRepository } from "../data/repository.js";
import type { LiturgicalFlags } from "../types/hours.js";
import type { GospelCanticleKind } from "../types/texts.js";
import { escapeTexPlain } from "./texEscape.js";

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
  const endPunct = flags.alleluiaInIntroVerse ? ", alleluia." : ".";
  const tail = flags.alleluiaInIntroVerse ? " Alleluia." : "";
  return `℣. ${fixed.opening}${endPunct}\n℟. ${fixed.response}${endPunct}\n${fixed.gloria.trim()}${tail}`;
}

export function formatInvitatoryVersePlain(repo: DataRepository): string {
  const fixed = repo.getFixedTexts()?.invitatoryVerse;
  if (!fixed) return FALLBACK.invitatory;
  return `℣. ${fixed.opening}\n℟. ${fixed.response}`;
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
  return `── OUR FATHER ─────────────────────────────\n\n${text}`;
}

export function formatComplineResponsoryPlain(repo: DataRepository): string {
  return repo.getFixedTexts()?.complineResponsory?.trim() ?? FALLBACK.complineResp;
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

export function resolvePsalmText(id: string, repo: DataRepository): string {
  const psalm = repo.getPsalm(id);
  if (psalm) return psalm.verses.map((v) => `${v.number}. ${v.text}`).join("\n");
  const canticle = repo.getCanticle(id);
  if (canticle) return canticle.verses.map((v) => `${v.number}. ${v.text}`).join("\n");
  return `[${id} — text not loaded]`;
}

// ---------------------------------------------------------------------------
// LaTeX
// ---------------------------------------------------------------------------

export function formatIntroductoryVerseTex(
  repo: DataRepository,
  flags: LiturgicalFlags,
): string {
  const plain = formatIntroductoryVersePlain(repo, flags);
  return plain
    .split("\n")
    .map((line) => {
      if (line.startsWith("℣. ")) {
        return `\\textbf{℣.} ${escapeTexPlain(line.slice(3))}`;
      }
      if (line.startsWith("℟. ")) {
        return `\\textbf{℟.} ${escapeTexPlain(line.slice(3))}`;
      }
      return escapeTexPlain(line);
    })
    .join("\\par\\smallskip\n");
}

export function formatGospelCanticleTex(
  repo: DataRepository,
  kind: GospelCanticleKind,
): string {
  const canticle = repo.getGospelCanticle(kind);
  if (!canticle) return escapeTexPlain(FALLBACK.gospel);
  return `${escapeTexPlain(canticle.reference)}\\par\\smallskip\n${escapeTexPlain(canticle.text)}`;
}

export function formatLordsPrayerTex(repo: DataRepository): string {
  const text = repo.getFixedTexts()?.lordsPrayer ?? FALLBACK.lordsPrayer;
  return escapeTexPlain(text);
}

export function formatDismissalTex(repo: DataRepository): string {
  const plain = formatDismissalPlain(repo);
  const lines = plain.split("\n");
  if (lines.length >= 2) {
    return `${escapeTexPlain(lines[0] ?? "")}\\par\\smallskip\n${escapeTexPlain(lines[1] ?? "")}`;
  }
  return escapeTexPlain(plain);
}
