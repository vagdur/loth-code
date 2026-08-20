/**
 * TexAssembler — LaTeX + GregorioTeX output for every liturgical hour.
 *
 * Emits semantic markup (see tex/loth.sty). GABC scores are written as sibling
 * `.gabc` files next to the `.tex` when exporting a bundle; GregorioTeX compiles
 * them incrementally when their content is unchanged.
 *
 * This mirrors PlainTextAssembler slot-for-slot (the reference implementation)
 * for liturgical structure and unscored text. When a slot carries GABC scores,
 * the sung lyrics render via Gregorio only — redundant plain macros are omitted.
 *
 * Output modes (constructor `outputMode`):
 *  - `hybrid` (default): scores when available, plain macros as fallback
 *  - `plain`: always plain macros, never emit GABC
 *  - `scored`: scores only; omit unscored prose; antiphons once per psalm slot
 */

import type { DataRepository } from "../data/repository.js";
import { eveningVespers } from "../hours/index.js";
import type {
  AbstractCompline, AbstractDay, AbstractDaytimePrayer,
  AbstractInvitatory, AbstractLauds, AbstractOfficeOfReadings, AbstractVespers,
} from "../types/hours.js";
import type { LiturgicalFlags } from "../types/hours.js";
import type {
  Antiphon, DialogueMelody, GospelCanticleKind, Hymn, PsalmAssignment, ShortResponsory,
} from "../types/texts.js";
import type { SectionLabelKey } from "./labels.js";
import type { LiturgicalDay } from "../types/calendar.js";
import type { Assembler, ResolveOptions } from "./types.js";
import {
  resolveAntiphon, resolveAntiphonList, resolveBiblicalReading,
  resolveConcludingPrayer, resolveHagiographicalReading, resolveHymn,
  resolveIntercessions, resolvePatristicReading, resolvePsalmAssignment,
  resolveShortReading, resolveShortResponsory, resolveVersicle,
} from "./types.js";
import { hydrateMelodies } from "../data/melodyResolver.js";
import { withGabcHeader } from "./gabcHeader.js";
import {
  assembleDialogueGabc,
  assembleShortResponsoryGabc,
  COMPLINE_BLESSING_PARTS,
  DISMISSAL_PARTS,
  INTRO_VERSE_PARTS,
  INVITATORY_VERSE_PARTS,
  OOR_ACCLAMATION_PARTS,
  PRAYER_PARTS,
  type DialoguePartSpec,
} from "./gabcDisplay.js";
import type { DayChoices } from "../types/options.js";
import type { HourKey } from "../options/slotTable.js";
import { slotPath } from "../options/slotTable.js";
import { resolveInvitatoryPsalmody } from "./invitatory.js";
import {
  texAntiphon,
  texComplineBlessing,
  texConcludingPrayer,
  texDismissal,
  texExaminationOfConscience,
  texGospelCanticle,
  texHeadedSection,
  texHourHeading,
  texHymn,
  texIntroductoryVerse,
  texIntercessions,
  texInvitatoryVerse,
  texLongResponsory,
  texLordsPrayerSection,
  texMelodyRubric,
  texScoredMelodyRubric,
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

export type TexOutputMode = "hybrid" | "plain" | "scored";

export interface TexAssemblerOptions {
  outputMode?: TexOutputMode;
}

export class TexAssembler implements Assembler<string> {
  private readonly outputMode: TexOutputMode;
  private scoreCounter = 0;
  private scorePrefix = "loth";
  private gabcFiles = new Map<string, string>();

  constructor(options?: TexAssemblerOptions) {
    this.outputMode = options?.outputMode ?? "hybrid";
  }

  private reset(): void {
    this.scoreCounter = 0;
    this.gabcFiles = new Map();
  }

  /**
   * Score names restart per hour (`<prefix>-score-1`, ...) so a full-day
   * assembly emits byte-identical score files to the standalone hour —
   * both may be written into one directory (e.g. the tex fixtures).
   * Scored-only mode uses `<prefix>-scored-score-1` so golden `.gabc`
   * files do not collide with hybrid fixtures in the same directory.
   */
  private startHourScores(prefix: string): void {
    this.scorePrefix = this.isScoredOnly() ? `${prefix}-scored` : prefix;
    this.scoreCounter = 0;
  }

  /** GABC score files keyed by filename (e.g. `lauds-score-1.gabc`). */
  getGabcFiles(): ReadonlyMap<string, string> {
    return this.gabcFiles;
  }

  private wrap(repo: DataRepository, body: string): string {
    return wrapLothDocument(repo, body);
  }

  private shouldEmitScores(): boolean {
    return this.outputMode !== "plain";
  }

  private isScoredOnly(): boolean {
    return this.outputMode === "scored";
  }

  private includePlainProse(): boolean {
    return !this.isScoredOnly();
  }

  private joinBody(body: string[]): string {
    return body.filter((s) => s.trim()).join("\n\n");
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
    bodies.push(this.vespersBody(eveningVespers(day), repo, choices));
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
    this.startHourScores("oor");
    const { flags } = hour;
    const opt = (slot: string) => slotOpts(choices, "officeOfReadings", slot);
    const body: string[] = [texHourHeading(repo, "officeOfReadings", hour.liturgicalDay)];

    if (hour.invitatory) {
      body.push(texHeadedSection(
        repo, "invitatory", ...this.texInvitatoryBlocks(hour.invitatory, repo, choices),
      ));
    } else {
      body.push(texHeadedSection(
        repo, "introductoryVerse",
        this.texIntroVerseBlock(repo, hour.liturgicalDay, flags, choices, "officeOfReadings"),
      ));
    }

    const hymn = resolveHymn(hour.hymnRef, repo, hour.liturgicalDay, opt("hymn"));
    if (hymn) body.push(texHeadedSection(repo, "hymn", this.texHymnBlock(hymn)));

    const psalmody: string[] = [];
    for (const [i, slot] of hour.psalmSlots.entries()) {
      const assignment = resolvePsalmAssignment(slot.assignmentRef, repo, hour.liturgicalDay, opt(`psalmSlots[${i}]`));
      if (assignment) {
        const psalmText = resolvePsalmText(assignment.psalmOrCanticleId, repo);
        psalmody.push(this.texPsalmAssignment(assignment, psalmText, flags, repo));
      }
    }
    body.push(texHeadedSection(repo, "psalmody", ...psalmody));

    const versicle = resolveVersicle(hour.versicleRef, repo, hour.liturgicalDay, opt("versicle"));
    if (versicle && this.includePlainProse()) {
      body.push(texHeadedSection(repo, "versicle", texVersicle(repo, versicle)));
    }

    const biblical = resolveBiblicalReading(hour.biblicalReadingRef, repo, undefined, opt("biblicalReading"));
    if (biblical && this.includePlainProse()) {
      body.push(texSectionHeading(repo, "firstReading"));
      body.push(texReading(biblical.reference, biblical.text));
      body.push(texLongResponsory(repo, biblical.responsory));
    }

    const patristic = resolvePatristicReading(hour.patristicReadingRef, repo, undefined, opt("patristicReading"));
    if (patristic && this.includePlainProse()) {
      body.push(texSectionHeading(repo, "secondReading"));
      body.push(texReading(`${patristic.author}, ${patristic.work}`, patristic.text));
      body.push(texLongResponsory(repo, patristic.responsory));
    }

    if (hour.memoriaAddendum) {
      const hagRead = resolveHagiographicalReading(hour.memoriaAddendum.hagiographicalReadingRef, repo, undefined, opt("memoriaAddendum.hagiographicalReading"));
      if (hagRead && this.includePlainProse()) {
        body.push(texSectionHeading(repo, "saintReading"));
        body.push(texReading(`${hagRead.author}, ${hagRead.work}`, hagRead.text));
        body.push(texLongResponsory(repo, hagRead.responsory));
      }
      const addPrayer = resolveConcludingPrayer(hour.memoriaAddendum.concludingPrayerRef, repo, undefined, opt("memoriaAddendum.concludingPrayer"));
      if (addPrayer && this.includePlainProse()) body.push(escapeTexPlain(addPrayer.text));
    }

    if (flags.teDeum && this.includePlainProse()) {
      body.push(texSectionHeading(repo, "teDeum"));
      body.push(texTeDeum(repo));
    }

    const prayer = resolveConcludingPrayer(hour.concludingPrayerRef, repo, undefined, opt("concludingPrayer"));
    if (prayer && this.includePlainProse()) {
      body.push(texHeadedSection(
        repo, "concludingPrayer", texConcludingPrayer(repo, prayer.text, "officeOfReadings"),
      ));
    }

    body.push(texHeadedSection(
      repo, "acclamation",
      this.texOorAcclamationBlock(repo, hour.liturgicalDay, choices, "officeOfReadings"),
    ));
    return this.joinBody(body);
  }

  private laudsBody(hour: AbstractLauds, repo: DataRepository, choices?: DayChoices): string {
    this.startHourScores("lauds");
    const { flags } = hour;
    const opt = (slot: string) => slotOpts(choices, "lauds", slot);
    const body: string[] = [texHourHeading(repo, "lauds", hour.liturgicalDay)];

    if (hour.invitatory) {
      body.push(texHeadedSection(
        repo, "invitatory", ...this.texInvitatoryBlocks(hour.invitatory, repo, choices),
      ));
    } else if (!hour.suppressIntroVerse) {
      body.push(texHeadedSection(
        repo, "introductoryVerse",
        this.texIntroVerseBlock(repo, hour.liturgicalDay, flags, choices, "lauds"),
      ));
    }

    const hymn = resolveHymn(hour.hymnRef, repo, hour.liturgicalDay, opt("hymn"));
    if (hymn) body.push(texHeadedSection(repo, "hymn", this.texHymnBlock(hymn)));

    const psalmody: string[] = [];
    for (const [i, slot] of hour.psalmSlots.entries()) {
      const assignment = resolvePsalmAssignment(slot.assignmentRef, repo, hour.liturgicalDay, opt(`psalmSlots[${i}]`));
      if (assignment) {
        const psalmText = resolvePsalmText(assignment.psalmOrCanticleId, repo);
        psalmody.push(this.texPsalmAssignment(assignment, psalmText, flags, repo));
      }
    }
    body.push(texHeadedSection(repo, "psalmody", ...psalmody));

    const reading = resolveShortReading(hour.shortReadingRef, repo, undefined, opt("shortReading"));
    if (reading && this.includePlainProse()) {
      body.push(texHeadedSection(repo, "reading", texShortReading(reading)));
    }

    if (hour.shortResponsoryRef) {
      const resp = resolveShortResponsory(hour.shortResponsoryRef, repo, hour.liturgicalDay, opt("shortResponsory"));
      if (resp) body.push(texHeadedSection(repo, "responsory", this.texShortResponsoryBlock(repo, resp)));
    }

    const benAntiphon = resolveAntiphon(hour.benedictusAntiphonRef, repo, hour.liturgicalDay, opt("benedictusAntiphon"));
    body.push(...this.texGospelCanticleSlot(repo, benAntiphon, flags, "benedictus", "benedictus"));

    const intercessions = resolveIntercessions(hour.intercessionsRef, repo, undefined, opt("intercessions"));
    if (intercessions && this.includePlainProse()) body.push(texIntercessions(repo, intercessions));

    body.push(texHeadedSection(
      repo, "ourFather", this.texLordsPrayerBlock(repo, hour.liturgicalDay, choices, "lauds"),
    ));

    const prayer = resolveConcludingPrayer(hour.concludingPrayerRef, repo, undefined, opt("concludingPrayer"));
    if (prayer && this.includePlainProse()) {
      body.push(texHeadedSection(repo, "concludingPrayer", texConcludingPrayer(repo, prayer.text, "lauds")));
    }

    if (hour.memoriaAddendum) {
      const addAntiphon = resolveAntiphon(hour.memoriaAddendum.antiphonRef, repo, hour.liturgicalDay, opt("memoriaAddendum.antiphon"));
      const addPrayer = resolveConcludingPrayer(hour.memoriaAddendum.concludingPrayerRef, repo, undefined, opt("memoriaAddendum.concludingPrayer"));
      body.push(texHeadedSection(
        repo, "memoriaAddendum",
        addAntiphon ? this.texAntiphonBlock(repo, addAntiphon, flags, true) : "",
        addPrayer && this.includePlainProse() ? escapeTexPlain(addPrayer.text) : "",
      ));
    }

    body.push(texHeadedSection(
      repo, "dismissal", this.texDismissalBlock(repo, hour.liturgicalDay, choices, "lauds"),
    ));
    return this.joinBody(body);
  }

  private daytimePrayerBody(hour: AbstractDaytimePrayer, repo: DataRepository, choices?: DayChoices): string {
    const hourKey = hour.kind;
    this.startHourScores(hourKey);
    const { flags } = hour;
    const opt = (slot: string) => slotOpts(choices, hourKey, slot);
    const body: string[] = [texHourHeading(repo, hourKey, hour.liturgicalDay)];

    body.push(texHeadedSection(
      repo, "introductoryVerse",
      this.texIntroVerseBlock(repo, hour.liturgicalDay, flags, choices, hourKey),
    ));

    const hymn = resolveHymn(hour.hymnRef, repo, hour.liturgicalDay, opt("hymn"));
    if (hymn) body.push(texHeadedSection(repo, "hymn", this.texHymnBlock(hymn)));

    body.push(texHeadedSection(repo, "psalmody", ...this.texDaytimePsalmody(repo, hour, flags, choices)));

    const reading = resolveShortReading(hour.shortReadingRef, repo, undefined, opt("shortReading"));
    if (reading && this.includePlainProse()) {
      body.push(texHeadedSection(repo, "reading", texShortReading(reading)));
    }

    const versicle = resolveVersicle(hour.versicleRef, repo, hour.liturgicalDay, opt("versicle"));
    if (versicle && this.includePlainProse()) {
      body.push(texHeadedSection(repo, "versicle", texVersicle(repo, versicle)));
    }

    const prayer = resolveConcludingPrayer(hour.concludingPrayerRef, repo, undefined, opt("concludingPrayer"));
    if (prayer && this.includePlainProse()) {
      body.push(texHeadedSection(repo, "concludingPrayer", texConcludingPrayer(repo, prayer.text, hourKey)));
    }

    body.push(texHeadedSection(
      repo, "acclamation",
      this.texOorAcclamationBlock(repo, hour.liturgicalDay, choices, hourKey),
    ));
    return this.joinBody(body);
  }

  private vespersBody(hour: AbstractVespers, repo: DataRepository, choices?: DayChoices): string {
    const hourKey: HourKey = hour.isFirstVespers ? "firstVespers" : "vespers";
    this.startHourScores(hourKey);
    const { flags } = hour;
    const opt = (slot: string) => slotOpts(choices, hourKey, slot);
    const body: string[] = [texHourHeading(repo, hourKey, hour.liturgicalDay)];

    body.push(texHeadedSection(
      repo, "introductoryVerse",
      this.texIntroVerseBlock(repo, hour.liturgicalDay, flags, choices, hourKey),
    ));

    const hymn = resolveHymn(hour.hymnRef, repo, hour.liturgicalDay, opt("hymn"));
    if (hymn) body.push(texHeadedSection(repo, "hymn", this.texHymnBlock(hymn)));

    const psalmody: string[] = [];
    for (const [i, slot] of hour.psalmSlots.entries()) {
      const assignment = resolvePsalmAssignment(slot.assignmentRef, repo, hour.liturgicalDay, opt(`psalmSlots[${i}]`));
      if (assignment) {
        const psalmText = resolvePsalmText(assignment.psalmOrCanticleId, repo);
        psalmody.push(this.texPsalmAssignment(assignment, psalmText, flags, repo));
      }
    }
    body.push(texHeadedSection(repo, "psalmody", ...psalmody));

    const reading = resolveShortReading(hour.shortReadingRef, repo, undefined, opt("shortReading"));
    if (reading && this.includePlainProse()) {
      body.push(texHeadedSection(repo, "reading", texShortReading(reading)));
    }

    if (hour.shortResponsoryRef) {
      const resp = resolveShortResponsory(hour.shortResponsoryRef, repo, hour.liturgicalDay, opt("shortResponsory"));
      if (resp) body.push(texHeadedSection(repo, "responsory", this.texShortResponsoryBlock(repo, resp)));
    }

    const magAntiphon = resolveAntiphon(hour.magnificatAntiphonRef, repo, hour.liturgicalDay, opt("magnificatAntiphon"));
    body.push(...this.texGospelCanticleSlot(repo, magAntiphon, flags, "magnificat", "magnificat"));

    const intercessions = resolveIntercessions(hour.intercessionsRef, repo, undefined, opt("intercessions"));
    if (intercessions && this.includePlainProse()) body.push(texIntercessions(repo, intercessions));

    body.push(texHeadedSection(
      repo, "ourFather", this.texLordsPrayerBlock(repo, hour.liturgicalDay, choices, hourKey),
    ));

    const prayer = resolveConcludingPrayer(hour.concludingPrayerRef, repo, undefined, opt("concludingPrayer"));
    if (prayer && this.includePlainProse()) {
      body.push(texHeadedSection(repo, "concludingPrayer", texConcludingPrayer(repo, prayer.text, hourKey)));
    }

    if (hour.memoriaAddendum) {
      const addAntiphon = resolveAntiphon(hour.memoriaAddendum.antiphonRef, repo, hour.liturgicalDay, opt("memoriaAddendum.antiphon"));
      const addPrayer = resolveConcludingPrayer(hour.memoriaAddendum.concludingPrayerRef, repo, undefined, opt("memoriaAddendum.concludingPrayer"));
      body.push(texHeadedSection(
        repo, "memoriaAddendum",
        addAntiphon ? this.texAntiphonBlock(repo, addAntiphon, flags, true) : "",
        addPrayer && this.includePlainProse() ? escapeTexPlain(addPrayer.text) : "",
      ));
    }

    body.push(texHeadedSection(
      repo, "dismissal", this.texDismissalBlock(repo, hour.liturgicalDay, choices, hourKey),
    ));
    return this.joinBody(body);
  }

  private complineBody(hour: AbstractCompline, repo: DataRepository, choices?: DayChoices): string {
    this.startHourScores("compline");
    const { flags } = hour;
    const opt = (slot: string) => slotOpts(choices, "compline", slot);
    const body: string[] = [texHourHeading(repo, "compline", hour.liturgicalDay)];

    body.push(texHeadedSection(
      repo, "introductoryVerse",
      this.texIntroVerseBlock(repo, hour.liturgicalDay, flags, choices, "compline"),
    ));
    if (this.includePlainProse()) {
      body.push(texHeadedSection(repo, "examination", texExaminationOfConscience(repo)));
    }

    const hymn = resolveHymn(hour.hymnRef, repo, hour.liturgicalDay, opt("hymn"));
    if (hymn) body.push(texHeadedSection(repo, "hymn", this.texHymnBlock(hymn)));

    const psalmody: string[] = [];
    for (const [i, slot] of hour.psalmSlots.entries()) {
      const assignment = resolvePsalmAssignment(slot.assignmentRef, repo, hour.liturgicalDay, opt(`psalmSlots[${i}]`));
      if (assignment) {
        const psalmText = resolvePsalmText(assignment.psalmOrCanticleId, repo);
        psalmody.push(this.texPsalmAssignment(assignment, psalmText, flags, repo));
      }
    }
    body.push(texHeadedSection(repo, "psalmody", ...psalmody));

    const reading = resolveShortReading(hour.shortReadingRef, repo, undefined, opt("shortReading"));
    if (reading && this.includePlainProse()) {
      body.push(texHeadedSection(repo, "reading", texShortReading(reading)));
    }

    const complineResp = getComplineResponsory(repo);
    if (complineResp) {
      const hydrated = hydrateMelodies(complineResp, repo, hour.liturgicalDay, {
        ...(choices ? { choices } : {}),
        path: slotPath("compline", "responsory"),
      });
      body.push(texHeadedSection(repo, "responsory", this.texShortResponsoryBlock(repo, hydrated)));
    } else if (this.includePlainProse()) {
      body.push(texHeadedSection(
        repo, "responsory", escapeTexPlain(formatComplineResponsoryFallbackPlain()),
      ));
    }

    const ndAntiphon = resolveAntiphon(hour.nuncDimittisAntiphonRef, repo, hour.liturgicalDay, opt("nuncDimittisAntiphon"));
    body.push(...this.texGospelCanticleSlot(repo, ndAntiphon, flags, "nuncDimittis", "nuncDimittis"));

    const prayer = resolveConcludingPrayer(hour.concludingPrayerRef, repo, undefined, opt("concludingPrayer"));
    if (prayer && this.includePlainProse()) {
      body.push(texHeadedSection(
        repo, "concludingPrayer", texConcludingPrayer(repo, prayer.text, "compline"),
      ));
    }

    body.push(texHeadedSection(
      repo, "blessing", this.texComplineBlessingBlock(repo, hour.liturgicalDay, choices),
    ));

    const marianAntiphon = resolveAntiphon(hour.marianAntiphonRef, repo, hour.liturgicalDay, opt("marianAntiphon"));
    if (marianAntiphon) {
      body.push(texHeadedSection(
        repo, "marianAntiphon", this.texAntiphonBlock(repo, marianAntiphon, flags, false),
      ));
    }

    return this.joinBody(body);
  }

  /**
   * Hydrate a fixed-text slot's melody refs and emit one merged score for
   * the listed parts (openings, closings, through-sung prayers). Plain text
   * markup is omitted when a score was emitted — GABC lyrics are authoritative.
   */
  private texFixedPartBlock<T extends { melody?: DialogueMelody }>(
    fixed: T | undefined,
    repo: DataRepository,
    day: LiturgicalDay,
    choices: DayChoices | undefined,
    path: string,
    parts: readonly DialoguePartSpec[],
    text: string,
  ): string {
    if (!fixed) {
      if (this.isScoredOnly()) return "";
      return text;
    }
    const hydrated = hydrateMelodies(fixed, repo, day, {
      ...(choices ? { choices } : {}),
      path,
    });
    const melody = hydrated.melody;

    if (this.outputMode === "plain") {
      const chunks: string[] = [];
      if (melody) {
        const rubric = texMelodyRubric(melody);
        if (rubric) chunks.push(rubric);
      }
      chunks.push(text);
      return chunks.join("\n\n");
    }

    if (!melody) {
      if (this.isScoredOnly()) return "";
      return text;
    }

    const merged = assembleDialogueGabc(melody, parts);
    const line = this.emitScore(merged, "antiphon", melody.mode);
    if (!line) {
      if (this.isScoredOnly()) return "";
      const chunks: string[] = [];
      const rubric = texMelodyRubric(melody);
      if (rubric) chunks.push(rubric);
      chunks.push(text);
      return chunks.join("\n\n");
    }
    const chunks: string[] = [];
    const rubric = texScoredMelodyRubric(melody);
    if (rubric) chunks.push(rubric);
    chunks.push(line);
    return chunks.join("\n\n");
  }

  private texIntroVerseBlock(
    repo: DataRepository,
    day: LiturgicalDay,
    flags: LiturgicalFlags,
    choices: DayChoices | undefined,
    hourKey: HourKey,
  ): string {
    // The concluding Halleluja is omitted in Lent, score included.
    const parts = flags.alleluiaInIntroVerse
      ? INTRO_VERSE_PARTS
      : INTRO_VERSE_PARTS.filter((p) => p.key !== "alleluia");
    return this.texFixedPartBlock(
      repo.getFixedTexts()?.introductoryVerse, repo, day, choices,
      slotPath(hourKey, "introVerse"), parts,
      texIntroductoryVerse(repo, flags),
    );
  }

  private texInvitatoryVerseBlock(
    repo: DataRepository,
    day: LiturgicalDay,
    choices: DayChoices | undefined,
  ): string {
    return this.texFixedPartBlock(
      repo.getFixedTexts()?.invitatoryVerse, repo, day, choices,
      slotPath("invitatory", "verse"), INVITATORY_VERSE_PARTS,
      texInvitatoryVerse(repo),
    );
  }

  /** office-spec §3.1 — invitatory verse + psalm with antiphon. */
  private texInvitatoryBlocks(
    invitatory: AbstractInvitatory,
    repo: DataRepository,
    choices?: DayChoices,
  ): string[] {
    const parts: string[] = [
      this.texInvitatoryVerseBlock(repo, invitatory.liturgicalDay, choices),
    ];
    const psalmody = resolveInvitatoryPsalmody(
      invitatory, repo, invitatory.liturgicalDay, choices,
    );
    if (psalmody) {
      parts.push(this.texPsalmAssignment(
        psalmody.assignment, psalmody.psalmText, invitatory.flags, repo,
      ));
    }
    return parts;
  }

  private texLordsPrayerBlock(
    repo: DataRepository,
    day: LiturgicalDay,
    choices: DayChoices | undefined,
    hourKey: HourKey,
  ): string {
    return this.texFixedPartBlock(
      repo.getFixedTexts()?.lordsPrayer, repo, day, choices,
      slotPath(hourKey, "lordsPrayer"), PRAYER_PARTS,
      texLordsPrayerSection(repo),
    );
  }

  private texOorAcclamationBlock(
    repo: DataRepository,
    day: LiturgicalDay,
    choices: DayChoices | undefined,
    hourKey: HourKey,
  ): string {
    return this.texFixedPartBlock(
      repo.getFixedTexts()?.oorAcclamation, repo, day, choices,
      slotPath(hourKey, "acclamation"), OOR_ACCLAMATION_PARTS,
      texOorAcclamation(repo),
    );
  }

  private texComplineBlessingBlock(
    repo: DataRepository,
    day: LiturgicalDay,
    choices: DayChoices | undefined,
  ): string {
    return this.texFixedPartBlock(
      repo.getFixedTexts()?.complineBlessing, repo, day, choices,
      slotPath("compline", "blessing"), COMPLINE_BLESSING_PARTS,
      texComplineBlessing(repo),
    );
  }

  private texDismissalBlock(
    repo: DataRepository,
    day: LiturgicalDay,
    choices: DayChoices | undefined,
    hourKey: HourKey,
  ): string {
    return this.texFixedPartBlock(
      repo.getFixedTexts()?.dismissalWithoutMinister, repo, day, choices,
      slotPath(hourKey, "dismissal"), DISMISSAL_PARTS,
      texDismissal(repo),
    );
  }

  /** Register a GABC score file, return score macro line or empty. */
  private emitScore(
    gabc: string | undefined,
    kind: "antiphon" | "psalmTone" = "antiphon",
    mode: number | undefined = undefined,
  ): string {
    if (!this.shouldEmitScores()) return "";
    const trimmed = gabc?.trim();
    if (!trimmed) return "";

    const base = `${this.scorePrefix}-score-${++this.scoreCounter}`;
    const filename = `${base}.gabc`;
    this.gabcFiles.set(filename, withGabcHeader(trimmed, base, mode !== undefined ? { mode } : undefined));
    return kind === "psalmTone" ? texPsalmToneScoreLine(base) : texScoreLine(base);
  }

  private texGospelCanticleSlot(
    repo: DataRepository,
    antiphon: Antiphon | undefined,
    flags: LiturgicalFlags,
    sectionKey: SectionLabelKey,
    canticleKind: GospelCanticleKind,
  ): string[] {
    const parts: string[] = [texSectionHeading(repo, sectionKey)];

    if (this.isScoredOnly()) {
      if (antiphon) {
        const block = this.texAntiphonBlock(repo, antiphon, flags, true);
        if (block) parts.push(block);
      }
      const incipit = this.texGospelIncipit(antiphon);
      if (incipit) parts.push(incipit);
      return parts;
    }

    if (antiphon) parts.push(this.texAntiphonBlock(repo, antiphon, flags, true));
    const incipit = this.texGospelIncipit(antiphon);
    if (incipit) parts.push(incipit);
    parts.push(texGospelCanticle(repo, canticleKind));
    if (antiphon) parts.push(this.texAntiphonBlock(repo, antiphon, flags, false));
    return parts;
  }

  /**
   * Pointed first verse of the gospel canticle (data-structure.md §2.1).
   * Score only: the lyrics are the canticle's opening line, so a prose
   * rendering would duplicate `\gospelCanticle`.
   */
  private texGospelIncipit(antiphon: Antiphon | undefined): string {
    return this.emitScore(antiphon?.firstVerse, "antiphon");
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
      if (this.isScoredOnly()) {
        const block = this.texAntiphonBlock(repo, antiphon, flags, true);
        return block ? [block] : [];
      }
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

  private texAntiphonBlock(
    repo: DataRepository,
    a: Antiphon,
    flags: LiturgicalFlags,
    includePsalmTone: boolean,
  ): string {
    let scoreLine = "";
    if (this.shouldEmitScores() && a.melody?.gabc) {
      scoreLine = this.emitScore(a.melody.gabc, "antiphon", a.melody.mode);
    }

    let toneLine = "";
    if (this.shouldEmitScores() && includePsalmTone && a.psalmTone?.trim()) {
      toneLine = this.emitScore(a.psalmTone, "psalmTone");
    }

    // Mode sits on the antiphon GABC header (above that drop cap), not the
    // psalm tone and not a \melodyRubric caption, whenever a lyric score
    // was emitted.
    const rubric = scoreLine
      ? texScoredMelodyRubric(a.melody)
      : texMelodyRubric(a.melody);

    const hasScore = Boolean(scoreLine || toneLine);

    if (this.isScoredOnly()) {
      if (!hasScore) return "";
      const chunks: string[] = [];
      if (rubric) chunks.push(rubric);
      if (scoreLine) chunks.push(scoreLine);
      if (toneLine) chunks.push(texPsalmToneBlock(toneLine));
      return chunks.join("\n\n");
    }

    const chunks: string[] = [];
    if (rubric) chunks.push(rubric);
    if (scoreLine) chunks.push(scoreLine);
    else chunks.push(texAntiphon(repo, a, flags));
    if (toneLine) chunks.push(texPsalmToneBlock(toneLine));
    return chunks.join("\n\n");
  }

  private texHymnBlock(hymn: Hymn): string {
    let scoreLine = "";
    if (this.shouldEmitScores() && hymn.melody?.gabc) {
      scoreLine = this.emitScore(hymn.melody.gabc, "antiphon", hymn.melody.mode);
    }

    const rubric = scoreLine
      ? texScoredMelodyRubric(hymn.melody)
      : texMelodyRubric(hymn.melody);

    if (this.isScoredOnly()) {
      if (!scoreLine) return "";
      const chunks: string[] = [];
      if (rubric) chunks.push(rubric);
      chunks.push(scoreLine);
      return chunks.join("\n\n");
    }

    const chunks: string[] = [];
    if (rubric) chunks.push(rubric);
    if (scoreLine) chunks.push(scoreLine);
    else chunks.push(texHymn(hymn));
    return chunks.join("\n\n");
  }

  private texPsalmAssignment(
    assignment: PsalmAssignment,
    psalmText: string,
    flags: LiturgicalFlags,
    repo: DataRepository,
  ): string {
    if (this.isScoredOnly()) {
      return this.texAntiphonBlock(repo, assignment.antiphon, flags, true);
    }

    const open = this.texAntiphonBlock(repo, assignment.antiphon, flags, true);
    if (!psalmText.trim()) return open;
    const canticleMelody: string[] = [];
    if (this.shouldEmitScores()) {
      const canticle = repo.getCanticle(assignment.psalmOrCanticleId);
      if (canticle?.melody?.gabc?.trim()) {
        const rub = texScoredMelodyRubric(canticle.melody);
        if (rub) canticleMelody.push(rub);
        const line = this.emitScore(canticle.melody.gabc, "antiphon", canticle.melody.mode);
        if (line) canticleMelody.push(line);
      }
    }
    const body = texPsalmText(psalmText);
    const close = this.texAntiphonBlock(repo, assignment.antiphon, flags, false);
    return [open, ...canticleMelody, body, close].join("\n\n");
  }

  private texShortResponsoryBlock(repo: DataRepository, r: ShortResponsory): string {
    let scoreLine = "";
    if (this.shouldEmitScores() && r.melody) {
      scoreLine = this.emitScore(
        assembleShortResponsoryGabc(r.melody), "antiphon", r.melody.mode,
      );
    }
    const rubric = scoreLine
      ? texScoredMelodyRubric(r.melody)
      : texMelodyRubric(r.melody);

    if (this.isScoredOnly()) {
      if (!scoreLine) return "";
      const chunks: string[] = [];
      if (rubric) chunks.push(rubric);
      chunks.push(scoreLine);
      return chunks.join("\n\n");
    }

    const chunks: string[] = [];
    if (rubric) chunks.push(rubric);
    if (scoreLine) chunks.push(scoreLine);
    else chunks.push(texShortResponsory(repo, r));
    return chunks.join("\n\n");
  }
}
