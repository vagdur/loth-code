/**
 * TexAssembler — LaTeX + GregorioTeX output for every liturgical hour.
 *
 * Emits semantic markup (see tex/loth.sty). GABC is embedded via `filecontents`
 * so a single `.tex` file is self-contained; copy loth.sty beside it to compile.
 *
 * This mirrors PlainTextAssembler slot-for-slot (the reference implementation);
 * both must produce the same liturgical content, formatted differently.
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
import type { Assembler, ResolveOptions } from "./types.js";
import {
  resolveAntiphon, resolveAntiphonList, resolveBiblicalReading,
  resolveConcludingPrayer, resolveHagiographicalReading, resolveHymn,
  resolveIntercessions, resolvePatristicReading, resolvePsalmAssignment,
  resolveShortReading, resolveShortResponsory, resolveVersicle,
} from "./types.js";
import { hydrateMelodies } from "../data/melodyResolver.js";
import type { DayChoices } from "../types/options.js";
import type { HourKey } from "../options/slotTable.js";
import { slotPath } from "../options/slotTable.js";
import {
  texAntiphon,
  texComplineBlessing,
  texConcludingPrayer,
  texDismissal,
  texExaminationOfConscience,
  texGospelCanticle,
  texHourHeading,
  texHymn,
  texIntroductoryVerse,
  texIntercessions,
  texInvitatoryVerse,
  texLongResponsory,
  texLordsPrayerSection,
  texMelodyRubric,
  texOorAcclamation,
  texPsalmText,
  texPsalmToneBlock,
  texPsalmToneScoreLine,
  texReading,
  texScoreLine,
  texSectionHeading,
  texShortReading,
  texShortResponsory,
  texTeDeum,
  texVersicle,
  wrapLothDocument,
} from "./liturgicalTex.js";
import {
  formatComplineResponsoryFallbackPlain,
  getComplineResponsory,
  resolvePsalmText,
} from "./liturgicalText.js";
import { escapeTexPlain } from "./texEscape.js";

/** Per-slot ResolveOptions carrying the day choices and this slot's option path. */
function slotOpts(
  choices: DayChoices | undefined,
  hourKey: HourKey,
  slotKey: string,
): ResolveOptions {
  return {
    ...(choices ? { choices } : {}),
    optionPath: slotPath(hourKey, slotKey),
  };
}

/**
 * Ensure a GABC body is a complete, compilable score: Gregorio requires a
 * header section terminated by a `%%` line before the notation. Our data
 * stores notation-only bodies, so prepend a minimal `name:…;` header unless the
 * body already carries its own `%%` delimiter.
 */
function withGabcHeader(gabc: string, name: string): string {
  if (/^%%\s*$/m.test(gabc)) return gabc;
  return `name:${name};\n%%\n${gabc}`;
}

export class TexAssembler implements Assembler<string> {
  private scoreCounter = 0;
  private scorePrefix = "loth";
  private fileContentsBlocks: string[] = [];

  private reset(): void {
    this.scoreCounter = 0;
    this.fileContentsBlocks = [];
  }

  private wrap(repo: DataRepository, body: string): string {
    return wrapLothDocument(repo, this.fileContentsBlocks.join("\n\n"), body);
  }

  // -------------------------------------------------------------------------
  // Public entry points — each resets score state, builds one body, wraps it.
  // assembleDay resets once and concatenates all hour bodies into one document.
  // -------------------------------------------------------------------------

  assembleDay(day: AbstractDay, repo: DataRepository, choices?: DayChoices): string {
    this.reset();
    const bodies: string[] = [
      this.officeOfReadingsBody(day.officeOfReadings, repo, choices),
      this.laudsBody(day.lauds, repo, choices),
    ];
    if (day.terce) bodies.push(this.daytimePrayerBody(day.terce, repo, choices));
    if (day.sext)  bodies.push(this.daytimePrayerBody(day.sext, repo, choices));
    if (day.none)  bodies.push(this.daytimePrayerBody(day.none, repo, choices));
    bodies.push(this.vespersBody(day.vespers, repo, choices));
    bodies.push(this.complineBody(day.compline, repo, choices));
    return this.wrap(repo, bodies.join("\n\n\\clearpage\n\n"));
  }

  assembleOfficeOfReadings(hour: AbstractOfficeOfReadings, repo: DataRepository, choices?: DayChoices): string {
    this.reset();
    return this.wrap(repo, this.officeOfReadingsBody(hour, repo, choices));
  }

  assembleLauds(hour: AbstractLauds, repo: DataRepository, choices?: DayChoices): string {
    this.reset();
    return this.wrap(repo, this.laudsBody(hour, repo, choices));
  }

  assembleDaytimePrayer(hour: AbstractDaytimePrayer, repo: DataRepository, choices?: DayChoices): string {
    this.reset();
    return this.wrap(repo, this.daytimePrayerBody(hour, repo, choices));
  }

  assembleVespers(hour: AbstractVespers, repo: DataRepository, choices?: DayChoices): string {
    this.reset();
    return this.wrap(repo, this.vespersBody(hour, repo, choices));
  }

  assembleCompline(hour: AbstractCompline, repo: DataRepository, choices?: DayChoices): string {
    this.reset();
    return this.wrap(repo, this.complineBody(hour, repo, choices));
  }

  // -------------------------------------------------------------------------
  // Per-hour body builders (no wrapping; append GABC to fileContentsBlocks).
  // -------------------------------------------------------------------------

  private officeOfReadingsBody(hour: AbstractOfficeOfReadings, repo: DataRepository, choices?: DayChoices): string {
    this.scorePrefix = "oor";
    const { flags } = hour;
    const opt = (slot: string) => slotOpts(choices, "officeOfReadings", slot);
    const body: string[] = [texHourHeading(repo, "officeOfReadings")];

    body.push(hour.isFirstHour ? texInvitatoryVerse(repo) : texIntroductoryVerse(repo, flags));

    const hymn = resolveHymn(hour.hymnRef, repo, hour.liturgicalDay, opt("hymn"));
    if (hymn) body.push(this.texHymnBlock(hymn));

    for (const [i, slot] of hour.psalmSlots.entries()) {
      const assignment = resolvePsalmAssignment(slot.assignmentRef, repo, hour.liturgicalDay, opt(`psalmSlots[${i}]`));
      if (assignment) {
        const psalmText = resolvePsalmText(assignment.psalmOrCanticleId, repo);
        body.push(this.texPsalmAssignment(assignment, psalmText, flags, repo));
      }
    }

    const versicle = resolveVersicle(hour.versicleRef, repo, hour.liturgicalDay, opt("versicle"));
    if (versicle) body.push(texVersicle(repo, versicle));

    const biblical = resolveBiblicalReading(hour.biblicalReadingRef, repo, undefined, opt("biblicalReading"));
    if (biblical) {
      body.push(texSectionHeading(repo, "firstReading"));
      body.push(texReading(biblical.reference, biblical.text));
      body.push(texLongResponsory(repo, biblical.responsory));
    }

    const patristic = resolvePatristicReading(hour.patristicReadingRef, repo, undefined, opt("patristicReading"));
    if (patristic) {
      body.push(texSectionHeading(repo, "secondReading"));
      body.push(texReading(`${patristic.author}, ${patristic.work}`, patristic.text));
      body.push(texLongResponsory(repo, patristic.responsory));
    }

    if (hour.memoriaAddendum) {
      const hagRead = resolveHagiographicalReading(hour.memoriaAddendum.hagiographicalReadingRef, repo, undefined, opt("memoriaAddendum.hagiographicalReading"));
      if (hagRead) {
        body.push(texSectionHeading(repo, "saintReading"));
        body.push(texReading(`${hagRead.author}, ${hagRead.work}`, hagRead.text));
        body.push(texLongResponsory(repo, hagRead.responsory));
      }
      const addPrayer = resolveConcludingPrayer(hour.memoriaAddendum.concludingPrayerRef, repo, undefined, opt("memoriaAddendum.concludingPrayer"));
      if (addPrayer) body.push(escapeTexPlain(addPrayer.text));
    }

    if (flags.teDeum) {
      body.push(texSectionHeading(repo, "teDeum"));
      body.push(texTeDeum(repo));
    }

    const prayer = resolveConcludingPrayer(hour.concludingPrayerRef, repo, undefined, opt("concludingPrayer"));
    if (prayer) body.push(texConcludingPrayer(repo, prayer.text, "officeOfReadings"));

    body.push(texOorAcclamation(repo));
    return body.join("\n\n");
  }

  private laudsBody(hour: AbstractLauds, repo: DataRepository, choices?: DayChoices): string {
    this.scorePrefix = "lauds";
    const { flags } = hour;
    const opt = (slot: string) => slotOpts(choices, "lauds", slot);
    const body: string[] = [texHourHeading(repo, "lauds")];

    if (!hour.suppressIntroVerse) body.push(texIntroductoryVerse(repo, flags));

    const hymn = resolveHymn(hour.hymnRef, repo, hour.liturgicalDay, opt("hymn"));
    if (hymn) body.push(this.texHymnBlock(hymn));

    for (const [i, slot] of hour.psalmSlots.entries()) {
      const assignment = resolvePsalmAssignment(slot.assignmentRef, repo, hour.liturgicalDay, opt(`psalmSlots[${i}]`));
      if (assignment) {
        const psalmText = resolvePsalmText(assignment.psalmOrCanticleId, repo);
        body.push(this.texPsalmAssignment(assignment, psalmText, flags, repo));
      }
    }

    const reading = resolveShortReading(hour.shortReadingRef, repo, undefined, opt("shortReading"));
    if (reading) body.push(texShortReading(reading));

    if (hour.shortResponsoryRef) {
      const resp = resolveShortResponsory(hour.shortResponsoryRef, repo, hour.liturgicalDay, opt("shortResponsory"));
      if (resp) body.push(this.texShortResponsoryBlock(repo, resp));
    }

    body.push(texSectionHeading(repo, "benedictus"));
    const benAntiphon = resolveAntiphon(hour.benedictusAntiphonRef, repo, hour.liturgicalDay, opt("benedictusAntiphon"));
    if (benAntiphon) body.push(this.texAntiphonBlock(repo, benAntiphon, flags, true));
    body.push(texGospelCanticle(repo, "benedictus"));
    if (benAntiphon) body.push(this.texAntiphonBlock(repo, benAntiphon, flags, false));

    const intercessions = resolveIntercessions(hour.intercessionsRef, repo, undefined, opt("intercessions"));
    if (intercessions) body.push(texIntercessions(repo, intercessions));

    body.push(texLordsPrayerSection(repo));

    const prayer = resolveConcludingPrayer(hour.concludingPrayerRef, repo, undefined, opt("concludingPrayer"));
    if (prayer) body.push(texConcludingPrayer(repo, prayer.text, "lauds"));

    if (hour.memoriaAddendum) {
      const addAntiphon = resolveAntiphon(hour.memoriaAddendum.antiphonRef, repo, hour.liturgicalDay, opt("memoriaAddendum.antiphon"));
      const addPrayer = resolveConcludingPrayer(hour.memoriaAddendum.concludingPrayerRef, repo, undefined, opt("memoriaAddendum.concludingPrayer"));
      if (addAntiphon) body.push(this.texAntiphonBlock(repo, addAntiphon, flags, true));
      if (addPrayer) body.push(escapeTexPlain(addPrayer.text));
    }

    body.push(texDismissal(repo));
    return body.join("\n\n");
  }

  private daytimePrayerBody(hour: AbstractDaytimePrayer, repo: DataRepository, choices?: DayChoices): string {
    const hourKey = hour.kind;
    this.scorePrefix = hourKey;
    const { flags } = hour;
    const opt = (slot: string) => slotOpts(choices, hourKey, slot);
    const body: string[] = [texHourHeading(repo, hourKey)];

    body.push(texIntroductoryVerse(repo, flags));

    const hymn = resolveHymn(hour.hymnRef, repo, hour.liturgicalDay, opt("hymn"));
    if (hymn) body.push(this.texHymnBlock(hymn));

    for (const part of this.texDaytimePsalmody(repo, hour, flags, choices)) {
      body.push(part);
    }

    const reading = resolveShortReading(hour.shortReadingRef, repo, undefined, opt("shortReading"));
    if (reading) body.push(texShortReading(reading));

    const versicle = resolveVersicle(hour.versicleRef, repo, hour.liturgicalDay, opt("versicle"));
    if (versicle) body.push(texVersicle(repo, versicle));

    const prayer = resolveConcludingPrayer(hour.concludingPrayerRef, repo, undefined, opt("concludingPrayer"));
    if (prayer) body.push(texConcludingPrayer(repo, prayer.text, hourKey));

    body.push(texOorAcclamation(repo));
    return body.join("\n\n");
  }

  private vespersBody(hour: AbstractVespers, repo: DataRepository, choices?: DayChoices): string {
    const hourKey: HourKey = hour.isFirstVespers ? "firstVespers" : "vespers";
    this.scorePrefix = hourKey;
    const { flags } = hour;
    const opt = (slot: string) => slotOpts(choices, hourKey, slot);
    const body: string[] = [texHourHeading(repo, hourKey)];

    body.push(texIntroductoryVerse(repo, flags));

    const hymn = resolveHymn(hour.hymnRef, repo, hour.liturgicalDay, opt("hymn"));
    if (hymn) body.push(this.texHymnBlock(hymn));

    for (const [i, slot] of hour.psalmSlots.entries()) {
      const assignment = resolvePsalmAssignment(slot.assignmentRef, repo, hour.liturgicalDay, opt(`psalmSlots[${i}]`));
      if (assignment) {
        const psalmText = resolvePsalmText(assignment.psalmOrCanticleId, repo);
        body.push(this.texPsalmAssignment(assignment, psalmText, flags, repo));
      }
    }

    const reading = resolveShortReading(hour.shortReadingRef, repo, undefined, opt("shortReading"));
    if (reading) body.push(texShortReading(reading));

    if (hour.shortResponsoryRef) {
      const resp = resolveShortResponsory(hour.shortResponsoryRef, repo, hour.liturgicalDay, opt("shortResponsory"));
      if (resp) body.push(this.texShortResponsoryBlock(repo, resp));
    }

    body.push(texSectionHeading(repo, "magnificat"));
    const magAntiphon = resolveAntiphon(hour.magnificatAntiphonRef, repo, hour.liturgicalDay, opt("magnificatAntiphon"));
    if (magAntiphon) body.push(this.texAntiphonBlock(repo, magAntiphon, flags, true));
    body.push(texGospelCanticle(repo, "magnificat"));
    if (magAntiphon) body.push(this.texAntiphonBlock(repo, magAntiphon, flags, false));

    const intercessions = resolveIntercessions(hour.intercessionsRef, repo, undefined, opt("intercessions"));
    if (intercessions) body.push(texIntercessions(repo, intercessions));

    body.push(texLordsPrayerSection(repo));

    const prayer = resolveConcludingPrayer(hour.concludingPrayerRef, repo, undefined, opt("concludingPrayer"));
    if (prayer) body.push(texConcludingPrayer(repo, prayer.text, hourKey));

    if (hour.memoriaAddendum) {
      const addAntiphon = resolveAntiphon(hour.memoriaAddendum.antiphonRef, repo, hour.liturgicalDay, opt("memoriaAddendum.antiphon"));
      const addPrayer = resolveConcludingPrayer(hour.memoriaAddendum.concludingPrayerRef, repo, undefined, opt("memoriaAddendum.concludingPrayer"));
      if (addAntiphon) body.push(this.texAntiphonBlock(repo, addAntiphon, flags, true));
      if (addPrayer) body.push(escapeTexPlain(addPrayer.text));
    }

    body.push(texDismissal(repo));
    return body.join("\n\n");
  }

  private complineBody(hour: AbstractCompline, repo: DataRepository, choices?: DayChoices): string {
    this.scorePrefix = "compline";
    const { flags } = hour;
    const opt = (slot: string) => slotOpts(choices, "compline", slot);
    const body: string[] = [texHourHeading(repo, "compline")];

    body.push(texIntroductoryVerse(repo, flags));
    body.push(texExaminationOfConscience(repo));

    const hymn = resolveHymn(hour.hymnRef, repo, hour.liturgicalDay, opt("hymn"));
    if (hymn) body.push(this.texHymnBlock(hymn));

    for (const [i, slot] of hour.psalmSlots.entries()) {
      const assignment = resolvePsalmAssignment(slot.assignmentRef, repo, hour.liturgicalDay, opt(`psalmSlots[${i}]`));
      if (assignment) {
        const psalmText = resolvePsalmText(assignment.psalmOrCanticleId, repo);
        body.push(this.texPsalmAssignment(assignment, psalmText, flags, repo));
      }
    }

    const reading = resolveShortReading(hour.shortReadingRef, repo, undefined, opt("shortReading"));
    if (reading) body.push(texShortReading(reading));

    const complineResp = getComplineResponsory(repo);
    if (complineResp) {
      const hydrated = hydrateMelodies(complineResp, repo, hour.liturgicalDay, {
        ...(choices ? { choices } : {}),
        path: slotPath("compline", "responsory"),
      });
      body.push(this.texShortResponsoryBlock(repo, hydrated));
    } else {
      body.push(escapeTexPlain(formatComplineResponsoryFallbackPlain()));
    }

    body.push(texSectionHeading(repo, "nuncDimittis"));
    const ndAntiphon = resolveAntiphon(hour.nuncDimittisAntiphonRef, repo, hour.liturgicalDay, opt("nuncDimittisAntiphon"));
    if (ndAntiphon) body.push(this.texAntiphonBlock(repo, ndAntiphon, flags, true));
    body.push(texGospelCanticle(repo, "nuncDimittis"));
    if (ndAntiphon) body.push(this.texAntiphonBlock(repo, ndAntiphon, flags, false));

    const prayer = resolveConcludingPrayer(hour.concludingPrayerRef, repo, undefined, opt("concludingPrayer"));
    if (prayer) body.push(texConcludingPrayer(repo, prayer.text, "compline"));

    body.push(texComplineBlessing(repo));

    const marianAntiphon = resolveAntiphon(hour.marianAntiphonRef, repo, hour.liturgicalDay, opt("marianAntiphon"));
    if (marianAntiphon) {
      body.push(texSectionHeading(repo, "marianAntiphon"));
      body.push(this.texAntiphonBlock(repo, marianAntiphon, flags, false));
    }

    return body.join("\n\n");
  }

  /** Register GABC via `filecontents`, return score macro line or empty. */
  private emitScore(
    gabc: string | undefined,
    kind: "antiphon" | "psalmTone" = "antiphon",
  ): string {
    const trimmed = gabc?.trim();
    if (!trimmed) return "";

    const base = `${this.scorePrefix}-score-${++this.scoreCounter}`;
    const filename = `${base}.gabc`;
    this.fileContentsBlocks.push(
      `\\begin{filecontents}[overwrite,noheader]{${filename}}\n${withGabcHeader(trimmed, base)}\n\\end{filecontents}`,
    );
    return kind === "psalmTone" ? texPsalmToneScoreLine(base) : texScoreLine(base);
  }

  /**
   * Daytime psalmody, honouring the 1-or-3 antiphon rule (GILH 122):
   *  - a single proper antiphon is sung around all three psalms;
   *  - three proper antiphons give one per psalm;
   *  - with no proper override, each psalm keeps its assignment's antiphon.
   * Mirrors renderDaytimePsalmodyPlain in plainText.ts.
   */
  private texDaytimePsalmody(
    repo: DataRepository,
    hour: AbstractDaytimePrayer,
    flags: LiturgicalFlags,
    choices?: DayChoices,
  ): string[] {
    const opt = (slot: string) => slotOpts(choices, hour.kind, slot);
    const assignments = hour.psalmSlots
      .map((slot, i) =>
        resolvePsalmAssignment(slot.assignmentRef, repo, hour.liturgicalDay, opt(`psalmSlots[${i}]`)),
      )
      .filter((a): a is PsalmAssignment => Boolean(a));

    const proper = hour.properAntiphonsRef
      ? resolveAntiphonList(hour.properAntiphonsRef, repo, hour.liturgicalDay, opt("properAntiphons"))
      : undefined;

    const psalmText = (a: PsalmAssignment) => resolvePsalmText(a.psalmOrCanticleId, repo);

    // One antiphon wrapping all three psalms.
    if (proper && proper.length === 1) {
      const antiphon = proper[0] as PsalmAssignment["antiphon"];
      const parts: string[] = [this.texAntiphonBlock(repo, antiphon, flags, true)];
      for (const a of assignments) {
        const text = psalmText(a);
        if (text.trim()) parts.push(texPsalmText(text));
      }
      parts.push(this.texAntiphonBlock(repo, antiphon, flags, false));
      return parts;
    }

    // Otherwise per-psalm: proper antiphons when as many as the psalms, else the
    // psalm assignment's own antiphon.
    const usePerPsalmProper = Boolean(proper && proper.length === assignments.length);
    return assignments.map((a, i) => {
      const antiphon = usePerPsalmProper ? proper![i]! : a.antiphon;
      return this.texPsalmAssignment({ ...a, antiphon }, psalmText(a), flags, repo);
    });
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
    if (!psalmText.trim()) return open;
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
