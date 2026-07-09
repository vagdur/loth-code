/**
 * LaudsTexAssembler — LaTeX + GregorioTeX output for Morning Prayer (Lauds).
 *
 * Emits semantic markup (see tex/loth.sty). GABC is embedded via `filecontents`
 * so a single `.tex` file is self-contained; copy loth.sty beside it to compile.
 */

import type { DataRepository } from "../data/repository.js";
import type {
  AbstractCompline, AbstractDay, AbstractDaytimePrayer,
  AbstractLauds, AbstractOfficeOfReadings, AbstractVespers,
} from "../types/hours.js";
import type { LiturgicalFlags } from "../types/hours.js";
import type {
  Antiphon, Hymn, PsalmAssignment, ShortResponsory,
} from "../types/texts.js";
import type { Assembler } from "./types.js";
import {
  resolveAntiphon, resolveConcludingPrayer, resolveHymn, resolveIntercessions,
  resolvePsalmAssignment, resolveShortReading, resolveShortResponsory,
} from "./types.js";
import {
  texAntiphon,
  texConcludingPrayer,
  texDismissal,
  texGospelCanticle,
  texHourHeading,
  texHymn,
  texIntroductoryVerse,
  texIntercessions,
  texLordsPrayerSection,
  texMelodyRubric,
  texPsalmText,
  texPsalmToneBlock,
  texPsalmToneScoreLine,
  texScoreLine,
  texSectionHeading,
  texShortReading,
  texShortResponsory,
  wrapLothDocument,
} from "./liturgicalTex.js";
import { resolvePsalmText } from "./liturgicalText.js";
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

    body.push(texHourHeading(repo, "lauds"));

    if (!hour.suppressIntroVerse) body.push(texIntroductoryVerse(repo, flags));

    const hymn = resolveHymn(hour.hymnRef, repo, hour.liturgicalDay);
    if (hymn) body.push(this.texHymnBlock(hymn));

    for (const slot of hour.psalmSlots) {
      const assignment = resolvePsalmAssignment(slot.assignmentRef, repo, hour.liturgicalDay);
      if (assignment) {
        const psalmText = resolvePsalmText(assignment.psalmOrCanticleId, repo);
        body.push(this.texPsalmAssignment(assignment, psalmText, flags, repo));
      }
    }

    const reading = resolveShortReading(hour.shortReadingRef, repo);
    if (reading) body.push(texShortReading(reading));

    if (hour.shortResponsoryRef) {
      const resp = resolveShortResponsory(hour.shortResponsoryRef, repo, hour.liturgicalDay);
      if (resp) body.push(this.texShortResponsoryBlock(repo, resp));
    }

    body.push(texSectionHeading(repo, "benedictus"));
    const benAntiphon = resolveAntiphon(hour.benedictusAntiphonRef, repo, hour.liturgicalDay);
    if (benAntiphon) body.push(this.texAntiphonBlock(repo, benAntiphon, flags, true));
    body.push(texGospelCanticle(repo, "benedictus"));
    if (benAntiphon) body.push(this.texAntiphonBlock(repo, benAntiphon, flags, false));

    const intercessions = resolveIntercessions(hour.intercessionsRef, repo);
    if (intercessions) body.push(texIntercessions(repo, intercessions));

    body.push(texLordsPrayerSection(repo));

    const prayer = resolveConcludingPrayer(hour.concludingPrayerRef, repo);
    if (prayer) body.push(texConcludingPrayer(repo, prayer.text, "lauds"));

    if (hour.memoriaAddendum) {
      const addAntiphon = resolveAntiphon(hour.memoriaAddendum.antiphonRef, repo, hour.liturgicalDay);
      const addPrayer = resolveConcludingPrayer(hour.memoriaAddendum.concludingPrayerRef, repo);
      if (addAntiphon) body.push(this.texAntiphonBlock(repo, addAntiphon, flags, true));
      if (addPrayer) body.push(escapeTexPlain(addPrayer.text));
    }

    body.push(texDismissal(repo));

    const blocks = this.fileContentsBlocks.join("\n\n");
    return wrapLothDocument(repo, blocks, body.join("\n\n"));
  }

  private notImplemented(method: string): string {
    return `% ${method} is not implemented for LaudsTexAssembler.\n\\documentclass{article}\\begin{document}Not implemented.\\end{document}`;
  }

  /** Register GABC via `filecontents`, return score macro line or empty. */
  private emitScore(
    gabc: string | undefined,
    kind: "antiphon" | "psalmTone" = "antiphon",
  ): string {
    const trimmed = gabc?.trim();
    if (!trimmed) return "";

    const base = `lauds-score-${++this.scoreCounter}`;
    const filename = `${base}.gabc`;
    this.fileContentsBlocks.push(
      `\\begin{filecontents}[overwrite,noheader]{${filename}}\n${trimmed}\n\\end{filecontents}`,
    );
    return kind === "psalmTone" ? texPsalmToneScoreLine(base) : texScoreLine(base);
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
    const rubric = texMelodyRubric(a.melody);
    if (rubric) chunks.push(rubric);
    if (a.melody?.gabc) {
      const line = this.emitScore(a.melody.gabc);
      if (line) chunks.push(line);
    }
    chunks.push(texAntiphon(repo, a, flags));
    if (includePsalmTone && a.psalmTone?.trim()) {
      const toneLine = this.emitScore(a.psalmTone, "psalmTone");
      if (toneLine) chunks.push(texPsalmToneBlock(toneLine));
    }
    return chunks.join("\n\n");
  }

  private texHymnBlock(hymn: Hymn): string {
    const chunks: string[] = [];
    const rubric = texMelodyRubric(hymn.melody);
    if (rubric) chunks.push(rubric);
    if (hymn.melody?.gabc) {
      const line = this.emitScore(hymn.melody.gabc);
      if (line) chunks.push(line);
    }
    chunks.push(texHymn(hymn));
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
      const rub = texMelodyRubric(canticle.melody);
      if (rub) canticleMelody.push(rub);
      const line = this.emitScore(canticle.melody.gabc);
      if (line) canticleMelody.push(line);
    }
    const body = texPsalmText(psalmText);
    const close = this.texAntiphonBlock(repo, assignment.antiphon, flags, false);
    return [open, ...canticleMelody, body, close].join("\n\n");
  }

  private texShortResponsoryBlock(repo: DataRepository, r: ShortResponsory): string {
    const chunks: string[] = [];
    const rubric = texMelodyRubric(r.melody);
    if (rubric) chunks.push(rubric);
    for (const gabc of [
      r.melody?.responsory,
      r.melody?.responsorySecond,
      r.melody?.versicle,
      r.melody?.gloria,
    ]) {
      const line = this.emitScore(gabc);
      if (line) chunks.push(line);
    }
    chunks.push(texShortResponsory(repo, r));
    return chunks.join("\n\n");
  }
}
