/**
 * Semantic LaTeX markup — role-based macros only; formatting lives in tex/loth.sty.
 */

import type { DataRepository } from "../data/repository.js";
import { formatOrdoDayHeadline } from "../ordo/headline.js";
import type { LiturgicalDay } from "../types/calendar.js";
import type { LiturgicalFlags } from "../types/hours.js";
import type {
  Antiphon, Hymn, Intercessions, LongResponsory, ShortResponsory, Versicle,
} from "../types/texts.js";
import type { GospelCanticleKind } from "../types/texts.js";
import {
  alleluiaAntiphonSuffix,
  formatResponseLinePlain,
  formatVersicleLinePlain,
  getLabels,
  includesLetUsPrayRubric,
  type HourLabelKey,
  type SectionLabelKey,
} from "./labels.js";
import {
  formatComplineBlessingPlain,
  formatDismissalPlain,
  formatExaminationOfConsciencePlain,
  formatIntroductoryVersePlain,
  formatInvitatoryVersePlain,
  formatLordsPrayerPlain,
  formatOorAcclamationPlain,
  formatTeDeumPlain,
} from "./liturgicalText.js";
import { escapeTexPlain } from "./texEscape.js";

/** Emit rubric configuration (call once after \\begin{document}). */
export function emitLothRubrics(repo: DataRepository): string {
  const { rubrics } = getLabels(repo);
  const psalmTone = rubrics.psalmTone ?? "Psalm tone";
  return [
    `\\LothRubricsAntiphonPrefix{${escapeTexPlain(rubrics.antiphonPrefix)}}`,
    `\\LothRubricsVersicleSymbol{${escapeTexPlain(rubrics.versicleSymbol)}}`,
    `\\LothRubricsResponseSymbol{${escapeTexPlain(rubrics.responseSymbol)}}`,
    `\\LothRubricsLetUsPray{${escapeTexPlain(rubrics.letUsPray)}}`,
    `\\LothRubricsPsalmToneLabel{${escapeTexPlain(psalmTone)}}`,
  ].join("\n");
}

export function texHourHeading(
  repo: DataRepository,
  key: HourLabelKey,
  liturgicalDay?: LiturgicalDay,
  calendarId = "general",
): string {
  const hour = getLabels(repo).hours[key];
  const ordoLabels = repo.getAssemblerLabels().ordo;
  const title = liturgicalDay && ordoLabels
    ? `${hour} - ${formatOrdoDayHeadline(liturgicalDay, ordoLabels, calendarId)}`
    : hour;
  return `\\hourHeading{${escapeTexPlain(title)}}`;
}

export function texSectionHeading(repo: DataRepository, key: SectionLabelKey): string {
  return `\\sectionHeading{${escapeTexPlain(getLabels(repo).sections[key])}}`;
}

export function texAntiphon(
  repo: DataRepository,
  a: Antiphon,
  flags: LiturgicalFlags,
): string {
  const alleluia = alleluiaAntiphonSuffix(repo, flags, a.suppressAlleluia);
  return `\\antiphon{${escapeTexPlain(a.text + alleluia)}}`;
}

/**
 * Editorial note only. Mode is a property of the melody (the GABC `mode:`
 * header when a score is present), not of the text, so it is never a caption.
 */
export function texMelodyRubric(m?: { note?: string }): string {
  return m?.note ? `\\melodyRubric{${escapeTexPlain(m.note)}}` : "";
}

/**
 * Same as {@link texMelodyRubric}; used at scored call sites.
 */
export function texScoredMelodyRubric(m?: { note?: string }): string {
  return texMelodyRubric(m);
}

export function texPsalmToneBlock(scoreLine: string): string {
  if (!scoreLine) return "";
  return `\\psalmToneLabel\n${scoreLine}`;
}

export function texHymn(hymn: Hymn): string {
  const stanzas = [...hymn.stanzas, hymn.doxology]
    .map((s) => `\\hymnStanza{${escapeTexPlain(s)}}`)
    .join(`\n\\LothHymnStanzaSep\n`);
  return `\\hymn{${stanzas}}`;
}

export function texShortReading(r: { reference: string; text: string }): string {
  return `\\shortReading{${escapeTexPlain(r.reference)}}{${escapeTexPlain(r.text)}}`;
}

export function texShortResponsory(_repo: DataRepository, r: ShortResponsory): string {
  return `\\shortResponsory{${escapeTexPlain(r.text)}}{${escapeTexPlain(r.versicle)}}{${escapeTexPlain(r.text)}}`;
}

/**
 * Render a plain versicle/response dialogue block (symbol-prefixed lines) into
 * `\versicle`/`\response` macros; lines without a known symbol pass through as
 * escaped text (e.g. the multi-line Gloria of the introductory verse).
 */
export function texDialogueLines(repo: DataRepository, plain: string): string {
  const labels = getLabels(repo).rubrics;
  return plain
    .split("\n")
    .map((line) => {
      if (line.startsWith(`${labels.versicleSymbol} `)) {
        return `\\versicle{${escapeTexPlain(line.slice(labels.versicleSymbol.length + 1))}}`;
      }
      if (line.startsWith(`${labels.responseSymbol} `)) {
        return `\\response{${escapeTexPlain(line.slice(labels.responseSymbol.length + 1))}}`;
      }
      return escapeTexPlain(line);
    })
    .join("\\LothVsmall\n");
}

export function texIntroductoryVerse(
  repo: DataRepository,
  flags: LiturgicalFlags,
): string {
  return texDialogueLines(repo, formatIntroductoryVersePlain(repo, flags));
}

export function texInvitatoryVerse(repo: DataRepository): string {
  return texDialogueLines(repo, formatInvitatoryVersePlain(repo));
}

/**
 * The OoR closing acclamation is an opaque raw data string (its own ℣./℟.
 * glyphs baked in), so emit it as escaped text rather than parsing it into
 * dialogue macros — matching PlainTextAssembler, which treats it as raw text.
 */
export function texOorAcclamation(repo: DataRepository): string {
  return formatOorAcclamationPlain(repo)
    .split("\n")
    .map((line) => escapeTexPlain(line))
    .join("\\LothVsmall\n");
}

/** Standalone versicle/response (OoR before readings, Daytime after reading). */
export function texVersicle(repo: DataRepository, v: Versicle): string {
  return texDialogueLines(
    repo,
    `${formatVersicleLinePlain(repo, v.verse)}\n${formatResponseLinePlain(repo, v.response)}`,
  );
}

/** Long responsory (OoR): same R/V/R shape as the short responsory macro. */
export function texLongResponsory(_repo: DataRepository, r: LongResponsory): string {
  return `\\shortResponsory{${escapeTexPlain(r.text)}}{${escapeTexPlain(r.verse)}}{${escapeTexPlain(r.repeatCue)}}`;
}

/** Long biblical/patristic/hagiographical reading: attribution then body. */
export function texReading(attribution: string, text: string): string {
  return `\\reading{${escapeTexPlain(attribution)}}{${escapeTexPlain(text)}}`;
}

export function texTeDeum(repo: DataRepository): string {
  return `\\teDeum{${escapeTexPlain(formatTeDeumPlain(repo))}}`;
}

export function texExaminationOfConscience(repo: DataRepository): string {
  return `\\examinationOfConscience{${escapeTexPlain(formatExaminationOfConsciencePlain(repo))}}`;
}

export function texComplineBlessing(repo: DataRepository): string {
  return `\\complineBlessing{${escapeTexPlain(formatComplineBlessingPlain(repo))}}`;
}

export function texGospelCanticle(
  repo: DataRepository,
  kind: GospelCanticleKind,
): string {
  const canticle = repo.getGospelCanticle(kind);
  if (!canticle) {
    return `\\gospelCanticle{}{${escapeTexPlain("[Gospel canticle — text not loaded]")}}`;
  }
  return `\\gospelCanticle{${escapeTexPlain(canticle.reference)}}{${escapeTexPlain(canticle.text)}}`;
}

export function texLordsPrayerSection(repo: DataRepository): string {
  const plain = formatLordsPrayerPlain(repo);
  const [, ...bodyParts] = plain.split("\n\n");
  const title = getLabels(repo).sections.ourFather;
  const body = bodyParts.join("\n\n");
  return `\\lordsPrayerSection{${escapeTexPlain(title)}}{${escapeTexPlain(body)}}`;
}

export function texConcludingPrayer(
  repo: DataRepository,
  text: string,
  hour: HourLabelKey | "firstVespers",
): string {
  if (!includesLetUsPrayRubric(hour)) {
    return `\\concludingPrayer{}{${escapeTexPlain(text)}}`;
  }
  const rubric = getLabels(repo).rubrics.letUsPray;
  return `\\concludingPrayer{${escapeTexPlain(rubric)}}{${escapeTexPlain(text)}}`;
}

export function texDismissal(repo: DataRepository): string {
  const plain = formatDismissalPlain(repo);
  const lines = plain.split("\n");
  if (lines.length >= 2) {
    return `\\dismissal{${escapeTexPlain(lines[0] ?? "")}}{${escapeTexPlain(lines[1] ?? "")}}`;
  }
  return `\\dismissal{${escapeTexPlain(plain)}}{}`;
}

export function texIntercessions(repo: DataRepository, i: Intercessions): string {
  const parts = [
    texSectionHeading(repo, "intercessions"),
    `\\intercessionsIntro{${escapeTexPlain(i.introduction)}}`,
    `\\intercessionsResponse{${escapeTexPlain(i.response)}}`,
    ...i.intentions.map(
      (int) =>
        `\\intention{${escapeTexPlain(int.firstPart)}}{${escapeTexPlain(int.secondPart)}}`,
    ),
  ];
  return parts.join("\n");
}

export function texPsalmText(text: string): string {
  return `\\psalmText{${escapeTexPlain(text)}}`;
}

export function texScoreLine(basename: string): string {
  return `\\lothScore{${basename}}`;
}

export function texPsalmToneScoreLine(basename: string): string {
  return `\\psalmToneScore{${basename}}`;
}

export function wrapLothDocument(
  repo: DataRepository,
  body: string,
): string {
  const rubrics = emitLothRubrics(repo);
  return `\\documentclass[11pt]{article}
\\usepackage{loth}
\\begin{document}
${rubrics}

${body}
\\end{document}
`;
}
