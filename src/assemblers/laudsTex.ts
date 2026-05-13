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

    body.push(texHeading("Lauds — Morning Prayer"));

    if (!hour.suppressIntroVerse) body.push(texIntroductoryVerse(flags));

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
      if (resp) body.push(this.texShortResponsory(resp));
    }

    body.push(texSubheading("Benedictus"));
    const benAntiphon = resolveAntiphon(hour.benedictuAntiphonRef, repo);
    if (benAntiphon) body.push(this.texAntiphonBlock(benAntiphon, flags, true));
    body.push(escapeTexPlain("[Benedictus text — Lk 1:68-79]"));
    if (benAntiphon) body.push(this.texAntiphonBlock(benAntiphon, flags, false));

    const intercessions = resolveIntercessions(hour.intercessionsRef, repo);
    if (intercessions) body.push(texIntercessions(intercessions, "morning"));

    body.push(texLordsPrayer());

    const prayer = resolveConcludingPrayer(hour.concludingPrayerRef, repo);
    if (prayer) body.push(texConcludingPrayer(prayer.text));

    if (hour.memoriaAddendum) {
      const addAntiphon = resolveAntiphon(hour.memoriaAddendum.antiphonRef, repo);
      const addPrayer = resolveConcludingPrayer(hour.memoriaAddendum.concludingPrayerRef, repo);
      if (addAntiphon) {
        body.push(escapeTexPlain("[Commemoration antiphon]"));
        body.push(this.texAntiphonBlock(addAntiphon, flags, true));
      }
      if (addPrayer) body.push(escapeTexPlain(addPrayer.text));
    }

    body.push(texDismissal());

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
  private texAntiphonBlock(a: Antiphon, flags: LiturgicalFlags, includePsalmTone: boolean): string {
    const chunks: string[] = [];
    const rubric = this.melodyRubric(a.melody);
    if (rubric) chunks.push(rubric);
    if (a.melody?.gabc) {
      const line = this.emitScore(a.melody.gabc);
      if (line) chunks.push(line);
    }
    const alleluia =
      flags.alleluiaInAntiphons && !a.suppressAlleluia ? " Alleluia." : "";
    chunks.push(`\\textbf{Ant.} ${escapeTexPlain(a.text + alleluia)}`);
    if (includePsalmTone && a.psalmTone?.trim()) {
      chunks.push("{\\small\\textit{Psalm tone}\\par}");
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
    const open = this.texAntiphonBlock(assignment.antiphon, flags, true);
    const canticleMelody: string[] = [];
    const canticle = repo.getCanticle(assignment.psalmOrCanticleId);
    if (canticle?.melody?.gabc?.trim()) {
      const rub = this.melodyRubric(canticle.melody);
      if (rub) canticleMelody.push(rub);
      const line = this.emitScore(canticle.melody.gabc);
      if (line) canticleMelody.push(line);
    }
    const body = escapeTexPlain(psalmText);
    const close = this.texAntiphonBlock(assignment.antiphon, flags, false);
    return [open, ...canticleMelody, body, close].join("\n\n");
  }

  private texShortResponsory(r: ShortResponsory): string {
    const chunks: string[] = [];
    const rubric = this.melodyRubric(r.melody);
    if (rubric) chunks.push(rubric);
    if (r.melody?.gabc) {
      const line = this.emitScore(r.melody.gabc);
      if (line) chunks.push(line);
    }
    chunks.push(
      [
        `\\textbf{℟.} ${escapeTexPlain(r.text)}`,
        `\\textbf{℣.} ${escapeTexPlain(r.versicle)}`,
        `\\textbf{℟.} ${escapeTexPlain(r.text)}`,
      ].join("\\par\\smallskip\n"),
    );
    return chunks.join("\n\n");
  }
}

function resolvePsalmText(id: string, repo: DataRepository): string {
  const psalm = repo.getPsalm(id);
  if (psalm) return psalm.verses.map((v) => `${v.number}. ${v.text}`).join("\n");
  const canticle = repo.getCanticle(id);
  if (canticle) return canticle.verses.map((v) => `${v.number}. ${v.text}`).join("\n");
  return `[${id} — text not loaded]`;
}

function texHeading(text: string): string {
  return `\\section*{${escapeTexPlain(text)}}`;
}

function texSubheading(text: string): string {
  return `\\subsection*{${escapeTexPlain(text)}}`;
}

function texIntroductoryVerse(flags: LiturgicalFlags): string {
  const alleluia = flags.alleluiaInIntroVerse ? ", alleluia." : ".";
  const tail = flags.alleluiaInIntroVerse ? " Alleluia." : "";
  return [
    `\\textbf{℣.} ${escapeTexPlain(`O God, come to our aid${alleluia}`)}`,
    `\\textbf{℟.} ${escapeTexPlain(`O Lord, make haste to help us${alleluia}`)}`,
    escapeTexPlain(
      `Glory be to the Father, and to the Son, and to the Holy Spirit,
as it was in the beginning, is now, and ever shall be, world without end. Amen.${tail}`,
    ),
  ].join("\\par\\smallskip\n");
}

function texShortReading(r: { reference: string; text: string }): string {
  return `${escapeTexPlain(r.reference)}\\par\\smallskip\n${escapeTexPlain(r.text)}`;
}

function texIntercessions(i: Intercessions, kind: "morning" | "evening"): string {
  const title = kind === "morning" ? "Intercessions" : "Intercessions";
  const lines = [
    texSubheading(title),
    escapeTexPlain(i.introduction),
    `\\textbf{℟.} ${escapeTexPlain(i.response)}`,
    ...i.intentions.map(
      (int) => `\\textbf{℣.} ${escapeTexPlain(int.firstPart)}\\par\\smallskip\n\\textbf{℟.} ${escapeTexPlain(int.secondPart)}`,
    ),
  ];
  return lines.join("\\par\\medskip\n");
}

function texLordsPrayer(): string {
  return `${texSubheading("Our Father")}\\par\\smallskip\n${escapeTexPlain(
    "Our Father, who art in heaven, hallowed be thy name…",
  )}`;
}

function texConcludingPrayer(text: string): string {
  return `${escapeTexPlain("Let us pray.")}\\par\\smallskip\n${escapeTexPlain(text)}`;
}

function texDismissal(): string {
  return `${escapeTexPlain("Go in the peace of Christ.")}\\par\\smallskip\n${escapeTexPlain("Thanks be to God.")}`;
}
