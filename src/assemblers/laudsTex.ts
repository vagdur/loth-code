/**
 * LaudsTexAssembler — LaTeX + GregorioTeX output for Morning Prayer (Lauds).
 *
 * Embeds GABC via the kernel `filecontents` environment so a single `.tex`
 * file is self-contained for LuaLaTeX. Optional `psalmTone` and antiphon
 * melodies are emitted when present on resolved objects.
 */

import type { DataRepository } from "../data/repository.js";
import type {
  AbstractCompline, AbstractDay, AbstractDaytimePrayer,
  AbstractLauds, AbstractOfficeOfReadings, AbstractVespers,
} from "../types/hours.js";
import type { LiturgicalFlags } from "../types/hours.js";
import type {
  Antiphon, Hymn, Intercessions, LongResponsory, Melody, PsalmAssignment,
  ShortResponsory, Versicle,
} from "../types/texts.js";
import type { Assembler } from "./types.js";
import {
  resolveAntiphon, resolveConcludingPrayer, resolveHymn, resolveIntercessions,
  resolvePsalmAssignment, resolveShortReading, resolveShortResponsory,
} from "./types.js";
import {
  alleluiaAntiphonSuffix,
  formatConcludingPrayerPlain,
  getLabels,
  type SectionLabelKey,
} from "./labels.js";
import {
  formatDismissalTex, formatGospelCanticleTex, formatIntroductoryVerseTex,
  formatLordsPrayerTex, resolvePsalmText,
} from "./liturgicalText.js";
import { escapeTexPlain } from "./texEscape.js";

export class LaudsTexAssembler implements Assembler<string> {
  private scoreCounter = 0;
  private fileContentsBlocks: string[] = [];

  assembleDay(_day: AbstractDay, _repo: DataRepository): string {
    return this.notImplemented("assembleDay");
  }

  assembleOfficeOfReadings(_hour: AbstractOfficeOfReadings, _repo: DataRepository): string {
    return this.notImplemented("assembleOfficeOfReadings");
  }

  assembleDaytimePrayer(_hour: AbstractDaytimePrayer, _repo: DataRepository): string {
    return this.notImplemented("assembleDaytimePrayer");
  }

  assembleVespers(_hour: AbstractVespers, _repo: DataRepository): string {
    return this.notImplemented("assembleVespers");
  }

  assembleCompline(_hour: AbstractCompline, _repo: DataRepository): string {
    return this.notImplemented("assembleCompline");
  }

  assembleLauds(hour: AbstractLauds, repo: DataRepository): string {
    this.scoreCounter = 0;
    this.fileContentsBlocks = [];

    const { flags } = hour;
    const body: string[] = [];

    body.push(texHeading(repo, "lauds"));

    if (!hour.suppressIntroVerse) body.push(formatIntroductoryVerseTex(repo, flags));

    const hymn = resolveHymn(hour.hymnRef, repo);
    if (hymn) body.push(this.texHymn(hymn));

    for (const slot of hour.psalmSlots) {
      const assignment = resolvePsalmAssignment(slot.assignmentRef, repo);
      if (assignment) {
        const psalmText = resolvePsalmText(assignment.psalmOrCanticleId, repo);
        body.push(this.texPsalmAssignment(assignment, psalmText, flags, repo));
      }
    }

    const reading = resolveShortReading(hour.shortReadingRef, repo);
    if (reading) body.push(texShortReading(reading));

    if (hour.shortResponsoryRef) {
      const resp = resolveShortResponsory(hour.shortResponsoryRef, repo);
      if (resp) body.push(this.texShortResponsory(repo, resp));
    }

    body.push(texSectionHeading(repo, "benedictus"));
    const benAntiphon = resolveAntiphon(hour.benedictuAntiphonRef, repo);
    if (benAntiphon) body.push(this.texAntiphonBlock(repo, benAntiphon, flags, true));
    body.push(formatGospelCanticleTex(repo, "benedictus"));
    if (benAntiphon) body.push(this.texAntiphonBlock(repo, benAntiphon, flags, false));

    const intercessions = resolveIntercessions(hour.intercessionsRef, repo);
    if (intercessions) body.push(texIntercessions(repo, intercessions));

    body.push(
      texSectionHeading(repo, "ourFather") + "\\par\\smallskip\n" + formatLordsPrayerTex(repo),
    );

    const prayer = resolveConcludingPrayer(hour.concludingPrayerRef, repo);
    if (prayer) body.push(texConcludingPrayer(repo, prayer.text));

    if (hour.memoriaAddendum) {
      const addAntiphon = resolveAntiphon(hour.memoriaAddendum.antiphonRef, repo);
      const addPrayer = resolveConcludingPrayer(hour.memoriaAddendum.concludingPrayerRef, repo);
      if (addAntiphon) body.push(this.texAntiphonBlock(repo, addAntiphon, flags, true));
      if (addPrayer) body.push(escapeTexPlain(addPrayer.text));
    }

    body.push(formatDismissalTex(repo));

    return this.wrapDocument(body.join("\n\n"));
  }

  private notImplemented(method: string): string {
    return `% ${method} is not implemented for LaudsTexAssembler.\n\\documentclass{article}\\begin{document}Not implemented.\\end{document}`;
  }

  private wrapDocument(body: string): string {
    const blocks = this.fileContentsBlocks.join("\n\n");
    return `${blocks}
\\documentclass[11pt]{article}
\\usepackage{gregoriotex}
\\begin{document}
${body}
\\end{document}
`;
  }

  /** Register GABC as a sibling file via `filecontents`, return \\gregorioscore line or empty. */
  private emitScore(gabc: string | undefined): string {
    const trimmed = gabc?.trim();
    if (!trimmed) return "";

    const base = `lauds-score-${++this.scoreCounter}`;
    const filename = `${base}.gabc`;
    this.fileContentsBlocks.push(
      `\\begin{filecontents}[overwrite,noheader]{${filename}}\n${trimmed}\n\\end{filecontents}`,
    );
    return `\\gregorioscore{${base}}`;
  }

  private melodyRubric(m?: Melody): string {
    if (!m) return "";
    const parts: string[] = [];
    if (m.mode !== undefined) parts.push(`Mode ${m.mode}`);
    if (m.note) parts.push(m.note);
    if (parts.length === 0) return "";
    return `{\\small\\textit{${escapeTexPlain(parts.join(" — "))}}\\par}`;
  }

  /**
   * @param includePsalmTone — opening psalmody antiphon includes tone GABC; closing repeat omits it.
   */
  private texAntiphonBlock(
    repo: DataRepository,
    a: Antiphon,
    flags: LiturgicalFlags,
    includePsalmTone: boolean,
  ): string {
    const chunks: string[] = [];
    const rubric = this.melodyRubric(a.melody);
    if (rubric) chunks.push(rubric);
    if (a.melody?.gabc) {
      const line = this.emitScore(a.melody.gabc);
      if (line) chunks.push(line);
    }
    const prefix = getLabels(repo).rubrics.antiphonPrefix;
    const alleluia = alleluiaAntiphonSuffix(repo, flags, a.suppressAlleluia);
    chunks.push(`\\textbf{${escapeTexPlain(prefix)}} ${escapeTexPlain(a.text + alleluia)}`);
    if (includePsalmTone && a.psalmTone?.trim()) {
      const psalmToneLabel = getLabels(repo).rubrics.psalmTone ?? "Psalm tone";
      chunks.push(`{\\small\\textit{${escapeTexPlain(psalmToneLabel)}}\\par}`);
      const toneLine = this.emitScore(a.psalmTone);
      if (toneLine) chunks.push(toneLine);
    }
    return chunks.join("\n\n");
  }

  private texHymn(hymn: Hymn): string {
    const chunks: string[] = [];
    const rubric = this.melodyRubric(hymn.melody);
    if (rubric) chunks.push(rubric);
    if (hymn.melody?.gabc) {
      const line = this.emitScore(hymn.melody.gabc);
      if (line) chunks.push(line);
    }
    const text = [...hymn.stanzas, hymn.doxology].map(escapeTexPlain).join("\\par\\par");
    chunks.push(text);
    return chunks.join("\n\n");
  }

  private texPsalmAssignment(
    assignment: PsalmAssignment,
    psalmText: string,
    flags: LiturgicalFlags,
    repo: DataRepository,
  ): string {
    const open = this.texAntiphonBlock(repo, assignment.antiphon, flags, true);
    const canticleMelody: string[] = [];
    const canticle = repo.getCanticle(assignment.psalmOrCanticleId);
    if (canticle?.melody?.gabc?.trim()) {
      const rub = this.melodyRubric(canticle.melody);
      if (rub) canticleMelody.push(rub);
      const line = this.emitScore(canticle.melody.gabc);
      if (line) canticleMelody.push(line);
    }
    const body = escapeTexPlain(psalmText);
    const close = this.texAntiphonBlock(repo, assignment.antiphon, flags, false);
    return [open, ...canticleMelody, body, close].join("\n\n");
  }

  private texShortResponsory(repo: DataRepository, r: ShortResponsory): string {
    const chunks: string[] = [];
    const rubric = this.melodyRubric(r.melody);
    if (rubric) chunks.push(rubric);
    if (r.melody?.gabc) {
      const line = this.emitScore(r.melody.gabc);
      if (line) chunks.push(line);
    }
    const { responseSymbol, versicleSymbol } = getLabels(repo).rubrics;
    chunks.push(
      [
        `\\textbf{${responseSymbol}} ${escapeTexPlain(r.text)}`,
        `\\textbf{${versicleSymbol}} ${escapeTexPlain(r.versicle)}`,
        `\\textbf{${responseSymbol}} ${escapeTexPlain(r.text)}`,
      ].join("\\par\\smallskip\n"),
    );
    return chunks.join("\n\n");
  }
}

function texHeading(repo: DataRepository, key: "lauds"): string {
  return `\\section*{${escapeTexPlain(getLabels(repo).hours[key])}}`;
}

function texSectionHeading(repo: DataRepository, key: SectionLabelKey): string {
  return `\\subsection*{${escapeTexPlain(getLabels(repo).sections[key])}}`;
}

function texShortReading(r: { reference: string; text: string }): string {
  return `${escapeTexPlain(r.reference)}\\par\\smallskip\n${escapeTexPlain(r.text)}`;
}

function texIntercessions(repo: DataRepository, i: Intercessions): string {
  const { responseSymbol, versicleSymbol } = getLabels(repo).rubrics;
  const lines = [
    texSectionHeading(repo, "intercessions"),
    escapeTexPlain(i.introduction),
    `\\textbf{${responseSymbol}} ${escapeTexPlain(i.response)}`,
    ...i.intentions.map(
      (int) =>
        `\\textbf{${versicleSymbol}} ${escapeTexPlain(int.firstPart)}\\par\\smallskip\n\\textbf{${responseSymbol}} ${escapeTexPlain(int.secondPart)}`,
    ),
  ];
  return lines.join("\\par\\medskip\n");
}

function texConcludingPrayer(repo: DataRepository, text: string): string {
  const plain = formatConcludingPrayerPlain(repo, text);
  const [rubric, ...rest] = plain.split("\n\n");
  return `${escapeTexPlain(rubric ?? "")}\\par\\smallskip\n${escapeTexPlain(rest.join("\n\n"))}`;
}
