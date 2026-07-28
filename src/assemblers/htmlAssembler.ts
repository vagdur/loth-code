/**
 * HtmlAssembler — HTML output for every liturgical hour, with chant rendered in
 * the browser by @vagdur/exsurge.
 *
 * Emits semantic markup (see html/loth.css). Unlike the LaTeX path, GABC does
 * not become sibling files: each score travels inline in a `data-gabc`
 * attribute, so an assembled page is self-contained. `mountScores` in
 * src/browser/lothChant.ts finds those mounts and hands each to exsurge, which
 * renders the notation and wires up click-to-play.
 *
 * This mirrors TexAssembler slot-for-slot — same body builders, same fallback
 * rules, same per-hour score numbering — so the two outputs stay comparable.
 *
 * Output modes (constructor `outputMode`):
 *  - `hybrid` (default): scores when available, plain markup as fallback
 *  - `plain`: always plain markup, never emit GABC
 *  - `scored`: scores only; omit unscored prose; antiphons once per psalm slot
 */

import type { DataRepository } from "../data/repository.js";
import type {
  AbstractCompline, AbstractDay, AbstractDaytimePrayer,
  AbstractLauds, AbstractOfficeOfReadings, AbstractVespers,
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
import type { DayChoices } from "../types/options.js";
import type { HourKey } from "../options/slotTable.js";
import { slotPath } from "../options/slotTable.js";
import {
  htmlAntiphon,
  htmlComplineBlessing,
  htmlConcludingPrayer,
  htmlDismissal,
  htmlExaminationOfConscience,
  htmlGospelCanticle,
  htmlHourFragment,
  htmlHourHeading,
  htmlHymn,
  htmlIntercessions,
  htmlIntroductoryVerse,
  htmlInvitatoryVerse,
  htmlLongResponsory,
  htmlLordsPrayerSection,
  htmlMelodyRubric,
  htmlOorAcclamation,
  htmlPlainProse,
  htmlPsalmText,
  htmlPsalmToneBlock,
  htmlPsalmToneScoreLine,
  htmlReading,
  htmlScoreLine,
  htmlSectionHeading,
  htmlShortReading,
  htmlShortResponsory,
  htmlTeDeum,
  htmlVersicle,
  wrapLothHtmlDocument,
  type LothHtmlDocumentOptions,
} from "./liturgicalHtml.js";
import {
  formatComplineResponsoryFallbackPlain,
  getComplineResponsory,
  resolvePsalmText,
} from "./liturgicalText.js";

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

export type HtmlOutputMode = "hybrid" | "plain" | "scored";

export interface HtmlAssemblerOptions {
  outputMode?: HtmlOutputMode;
  /** Page-level options used when an entry point wraps its body in a document. */
  document?: LothHtmlDocumentOptions;
  /** Return bare `<article>` fragments instead of a full page. Default false. */
  fragmentOnly?: boolean;
}

export class HtmlAssembler implements Assembler<string> {
  private readonly outputMode: HtmlOutputMode;
  private readonly documentOptions: LothHtmlDocumentOptions | undefined;
  private readonly fragmentOnly: boolean;
  private scoreCounter = 0;
  private scorePrefix = "loth";
  private scores = new Map<string, string>();

  constructor(options?: HtmlAssemblerOptions) {
    this.outputMode = options?.outputMode ?? "hybrid";
    this.documentOptions = options?.document;
    this.fragmentOnly = options?.fragmentOnly ?? false;
  }

  private reset(): void {
    this.scoreCounter = 0;
    this.scores = new Map();
  }

  /**
   * Score ids restart per hour (`<prefix>-score-1`, ...), matching TexAssembler
   * so an HTML page and its `.tex` sibling number their scores identically.
   * Scored-only mode uses `<prefix>-scored-score-1`, again as in LaTeX.
   */
  private startHourScores(prefix: string): void {
    this.scorePrefix = this.isScoredOnly() ? `${prefix}-scored` : prefix;
    this.scoreCounter = 0;
  }

  /**
   * Every score emitted by the last assemble call, keyed by score id and
   * carrying the same header-normalised GABC that went into `data-gabc`. Lets a
   * host pre-render server-side (exsurge's `createSvgTree`) instead of mounting
   * in the browser, and lets tests check each score without parsing HTML.
   */
  getScores(): ReadonlyMap<string, string> {
    return this.scores;
  }

  private wrap(repo: DataRepository, body: string): string {
    if (this.fragmentOnly) return body;
    return wrapLothHtmlDocument(repo, body, this.documentOptions);
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
      htmlHourFragment("officeOfReadings", this.officeOfReadingsBody(day.officeOfReadings, repo, choices)),
      htmlHourFragment("lauds", this.laudsBody(day.lauds, repo, choices)),
    ];
    if (day.terce) bodies.push(htmlHourFragment("terce", this.daytimePrayerBody(day.terce, repo, choices)));
    if (day.sext)  bodies.push(htmlHourFragment("sext", this.daytimePrayerBody(day.sext, repo, choices)));
    if (day.none)  bodies.push(htmlHourFragment("none", this.daytimePrayerBody(day.none, repo, choices)));
    bodies.push(htmlHourFragment(
      day.vespers.isFirstVespers ? "firstVespers" : "vespers",
      this.vespersBody(day.vespers, repo, choices),
    ));
    bodies.push(htmlHourFragment("compline", this.complineBody(day.compline, repo, choices)));
    return this.wrap(repo, bodies.join('\n<hr class="loth-page-break">\n'));
  }

  assembleOfficeOfReadings(hour: AbstractOfficeOfReadings, repo: DataRepository, choices?: DayChoices): string {
    this.reset();
    return this.wrap(repo, htmlHourFragment("officeOfReadings", this.officeOfReadingsBody(hour, repo, choices)));
  }

  assembleLauds(hour: AbstractLauds, repo: DataRepository, choices?: DayChoices): string {
    this.reset();
    return this.wrap(repo, htmlHourFragment("lauds", this.laudsBody(hour, repo, choices)));
  }

  assembleDaytimePrayer(hour: AbstractDaytimePrayer, repo: DataRepository, choices?: DayChoices): string {
    this.reset();
    return this.wrap(repo, htmlHourFragment(hour.kind, this.daytimePrayerBody(hour, repo, choices)));
  }

  assembleVespers(hour: AbstractVespers, repo: DataRepository, choices?: DayChoices): string {
    this.reset();
    const key = hour.isFirstVespers ? "firstVespers" : "vespers";
    return this.wrap(repo, htmlHourFragment(key, this.vespersBody(hour, repo, choices)));
  }

  assembleCompline(hour: AbstractCompline, repo: DataRepository, choices?: DayChoices): string {
    this.reset();
    return this.wrap(repo, htmlHourFragment("compline", this.complineBody(hour, repo, choices)));
  }

  // -------------------------------------------------------------------------
  // Per-hour body builders (no wrapping; register scores as they go).
  // -------------------------------------------------------------------------

  private officeOfReadingsBody(hour: AbstractOfficeOfReadings, repo: DataRepository, choices?: DayChoices): string {
    this.startHourScores("oor");
    const { flags } = hour;
    const opt = (slot: string) => slotOpts(choices, "officeOfReadings", slot);
    const body: string[] = [htmlHourHeading(repo, "officeOfReadings", hour.liturgicalDay)];

    body.push(
      hour.isFirstHour
        ? this.htmlInvitatoryVerseBlock(repo, hour.liturgicalDay, choices)
        : this.htmlIntroVerseBlock(repo, hour.liturgicalDay, flags, choices, "officeOfReadings"),
    );

    const hymn = resolveHymn(hour.hymnRef, repo, hour.liturgicalDay, opt("hymn"));
    if (hymn) body.push(this.htmlHymnBlock(hymn));

    for (const [i, slot] of hour.psalmSlots.entries()) {
      const assignment = resolvePsalmAssignment(slot.assignmentRef, repo, hour.liturgicalDay, opt(`psalmSlots[${i}]`));
      if (assignment) {
        const psalmText = resolvePsalmText(assignment.psalmOrCanticleId, repo);
        body.push(this.htmlPsalmAssignment(assignment, psalmText, flags, repo));
      }
    }

    const versicle = resolveVersicle(hour.versicleRef, repo, hour.liturgicalDay, opt("versicle"));
    if (versicle && this.includePlainProse()) body.push(htmlVersicle(repo, versicle));

    const biblical = resolveBiblicalReading(hour.biblicalReadingRef, repo, undefined, opt("biblicalReading"));
    if (biblical && this.includePlainProse()) {
      body.push(htmlSectionHeading(repo, "firstReading"));
      body.push(htmlReading(biblical.reference, biblical.text));
      body.push(htmlLongResponsory(repo, biblical.responsory));
    }

    const patristic = resolvePatristicReading(hour.patristicReadingRef, repo, undefined, opt("patristicReading"));
    if (patristic && this.includePlainProse()) {
      body.push(htmlSectionHeading(repo, "secondReading"));
      body.push(htmlReading(`${patristic.author}, ${patristic.work}`, patristic.text));
      body.push(htmlLongResponsory(repo, patristic.responsory));
    }

    if (hour.memoriaAddendum) {
      const hagRead = resolveHagiographicalReading(hour.memoriaAddendum.hagiographicalReadingRef, repo, undefined, opt("memoriaAddendum.hagiographicalReading"));
      if (hagRead && this.includePlainProse()) {
        body.push(htmlSectionHeading(repo, "saintReading"));
        body.push(htmlReading(`${hagRead.author}, ${hagRead.work}`, hagRead.text));
        body.push(htmlLongResponsory(repo, hagRead.responsory));
      }
      const addPrayer = resolveConcludingPrayer(hour.memoriaAddendum.concludingPrayerRef, repo, undefined, opt("memoriaAddendum.concludingPrayer"));
      if (addPrayer && this.includePlainProse()) body.push(htmlPlainProse(addPrayer.text));
    }

    if (flags.teDeum && this.includePlainProse()) {
      body.push(htmlSectionHeading(repo, "teDeum"));
      body.push(htmlTeDeum(repo));
    }

    const prayer = resolveConcludingPrayer(hour.concludingPrayerRef, repo, undefined, opt("concludingPrayer"));
    if (prayer && this.includePlainProse()) body.push(htmlConcludingPrayer(repo, prayer.text, "officeOfReadings"));

    body.push(this.htmlOorAcclamationBlock(repo, hour.liturgicalDay, choices, "officeOfReadings"));
    return this.joinBody(body);
  }

  private laudsBody(hour: AbstractLauds, repo: DataRepository, choices?: DayChoices): string {
    this.startHourScores("lauds");
    const { flags } = hour;
    const opt = (slot: string) => slotOpts(choices, "lauds", slot);
    const body: string[] = [htmlHourHeading(repo, "lauds", hour.liturgicalDay)];

    if (!hour.suppressIntroVerse) {
      body.push(this.htmlIntroVerseBlock(repo, hour.liturgicalDay, flags, choices, "lauds"));
    }

    const hymn = resolveHymn(hour.hymnRef, repo, hour.liturgicalDay, opt("hymn"));
    if (hymn) body.push(this.htmlHymnBlock(hymn));

    for (const [i, slot] of hour.psalmSlots.entries()) {
      const assignment = resolvePsalmAssignment(slot.assignmentRef, repo, hour.liturgicalDay, opt(`psalmSlots[${i}]`));
      if (assignment) {
        const psalmText = resolvePsalmText(assignment.psalmOrCanticleId, repo);
        body.push(this.htmlPsalmAssignment(assignment, psalmText, flags, repo));
      }
    }

    const reading = resolveShortReading(hour.shortReadingRef, repo, undefined, opt("shortReading"));
    if (reading && this.includePlainProse()) body.push(htmlShortReading(reading));

    if (hour.shortResponsoryRef) {
      const resp = resolveShortResponsory(hour.shortResponsoryRef, repo, hour.liturgicalDay, opt("shortResponsory"));
      if (resp) body.push(this.htmlShortResponsoryBlock(repo, resp));
    }

    const benAntiphon = resolveAntiphon(hour.benedictusAntiphonRef, repo, hour.liturgicalDay, opt("benedictusAntiphon"));
    body.push(...this.htmlGospelCanticleSlot(repo, benAntiphon, flags, "benedictus", "benedictus"));

    const intercessions = resolveIntercessions(hour.intercessionsRef, repo, undefined, opt("intercessions"));
    if (intercessions && this.includePlainProse()) body.push(htmlIntercessions(repo, intercessions));

    body.push(this.htmlLordsPrayerBlock(repo, hour.liturgicalDay, choices, "lauds"));

    const prayer = resolveConcludingPrayer(hour.concludingPrayerRef, repo, undefined, opt("concludingPrayer"));
    if (prayer && this.includePlainProse()) body.push(htmlConcludingPrayer(repo, prayer.text, "lauds"));

    if (hour.memoriaAddendum) {
      const addAntiphon = resolveAntiphon(hour.memoriaAddendum.antiphonRef, repo, hour.liturgicalDay, opt("memoriaAddendum.antiphon"));
      const addPrayer = resolveConcludingPrayer(hour.memoriaAddendum.concludingPrayerRef, repo, undefined, opt("memoriaAddendum.concludingPrayer"));
      if (addAntiphon) body.push(this.htmlAntiphonBlock(repo, addAntiphon, flags, true));
      if (addPrayer && this.includePlainProse()) body.push(htmlPlainProse(addPrayer.text));
    }

    body.push(this.htmlDismissalBlock(repo, hour.liturgicalDay, choices, "lauds"));
    return this.joinBody(body);
  }

  private daytimePrayerBody(hour: AbstractDaytimePrayer, repo: DataRepository, choices?: DayChoices): string {
    const hourKey = hour.kind;
    this.startHourScores(hourKey);
    const { flags } = hour;
    const opt = (slot: string) => slotOpts(choices, hourKey, slot);
    const body: string[] = [htmlHourHeading(repo, hourKey, hour.liturgicalDay)];

    body.push(this.htmlIntroVerseBlock(repo, hour.liturgicalDay, flags, choices, hourKey));

    const hymn = resolveHymn(hour.hymnRef, repo, hour.liturgicalDay, opt("hymn"));
    if (hymn) body.push(this.htmlHymnBlock(hymn));

    for (const part of this.htmlDaytimePsalmody(repo, hour, flags, choices)) {
      body.push(part);
    }

    const reading = resolveShortReading(hour.shortReadingRef, repo, undefined, opt("shortReading"));
    if (reading && this.includePlainProse()) body.push(htmlShortReading(reading));

    const versicle = resolveVersicle(hour.versicleRef, repo, hour.liturgicalDay, opt("versicle"));
    if (versicle && this.includePlainProse()) body.push(htmlVersicle(repo, versicle));

    const prayer = resolveConcludingPrayer(hour.concludingPrayerRef, repo, undefined, opt("concludingPrayer"));
    if (prayer && this.includePlainProse()) body.push(htmlConcludingPrayer(repo, prayer.text, hourKey));

    body.push(this.htmlOorAcclamationBlock(repo, hour.liturgicalDay, choices, hourKey));
    return this.joinBody(body);
  }

  private vespersBody(hour: AbstractVespers, repo: DataRepository, choices?: DayChoices): string {
    const hourKey: HourKey = hour.isFirstVespers ? "firstVespers" : "vespers";
    this.startHourScores(hourKey);
    const { flags } = hour;
    const opt = (slot: string) => slotOpts(choices, hourKey, slot);
    const body: string[] = [htmlHourHeading(repo, hourKey, hour.liturgicalDay)];

    body.push(this.htmlIntroVerseBlock(repo, hour.liturgicalDay, flags, choices, hourKey));

    const hymn = resolveHymn(hour.hymnRef, repo, hour.liturgicalDay, opt("hymn"));
    if (hymn) body.push(this.htmlHymnBlock(hymn));

    for (const [i, slot] of hour.psalmSlots.entries()) {
      const assignment = resolvePsalmAssignment(slot.assignmentRef, repo, hour.liturgicalDay, opt(`psalmSlots[${i}]`));
      if (assignment) {
        const psalmText = resolvePsalmText(assignment.psalmOrCanticleId, repo);
        body.push(this.htmlPsalmAssignment(assignment, psalmText, flags, repo));
      }
    }

    const reading = resolveShortReading(hour.shortReadingRef, repo, undefined, opt("shortReading"));
    if (reading && this.includePlainProse()) body.push(htmlShortReading(reading));

    if (hour.shortResponsoryRef) {
      const resp = resolveShortResponsory(hour.shortResponsoryRef, repo, hour.liturgicalDay, opt("shortResponsory"));
      if (resp) body.push(this.htmlShortResponsoryBlock(repo, resp));
    }

    const magAntiphon = resolveAntiphon(hour.magnificatAntiphonRef, repo, hour.liturgicalDay, opt("magnificatAntiphon"));
    body.push(...this.htmlGospelCanticleSlot(repo, magAntiphon, flags, "magnificat", "magnificat"));

    const intercessions = resolveIntercessions(hour.intercessionsRef, repo, undefined, opt("intercessions"));
    if (intercessions && this.includePlainProse()) body.push(htmlIntercessions(repo, intercessions));

    body.push(this.htmlLordsPrayerBlock(repo, hour.liturgicalDay, choices, hourKey));

    const prayer = resolveConcludingPrayer(hour.concludingPrayerRef, repo, undefined, opt("concludingPrayer"));
    if (prayer && this.includePlainProse()) body.push(htmlConcludingPrayer(repo, prayer.text, hourKey));

    if (hour.memoriaAddendum) {
      const addAntiphon = resolveAntiphon(hour.memoriaAddendum.antiphonRef, repo, hour.liturgicalDay, opt("memoriaAddendum.antiphon"));
      const addPrayer = resolveConcludingPrayer(hour.memoriaAddendum.concludingPrayerRef, repo, undefined, opt("memoriaAddendum.concludingPrayer"));
      if (addAntiphon) body.push(this.htmlAntiphonBlock(repo, addAntiphon, flags, true));
      if (addPrayer && this.includePlainProse()) body.push(htmlPlainProse(addPrayer.text));
    }

    body.push(this.htmlDismissalBlock(repo, hour.liturgicalDay, choices, hourKey));
    return this.joinBody(body);
  }

  private complineBody(hour: AbstractCompline, repo: DataRepository, choices?: DayChoices): string {
    this.startHourScores("compline");
    const { flags } = hour;
    const opt = (slot: string) => slotOpts(choices, "compline", slot);
    const body: string[] = [htmlHourHeading(repo, "compline", hour.liturgicalDay)];

    body.push(this.htmlIntroVerseBlock(repo, hour.liturgicalDay, flags, choices, "compline"));
    if (this.includePlainProse()) body.push(htmlExaminationOfConscience(repo));

    const hymn = resolveHymn(hour.hymnRef, repo, hour.liturgicalDay, opt("hymn"));
    if (hymn) body.push(this.htmlHymnBlock(hymn));

    for (const [i, slot] of hour.psalmSlots.entries()) {
      const assignment = resolvePsalmAssignment(slot.assignmentRef, repo, hour.liturgicalDay, opt(`psalmSlots[${i}]`));
      if (assignment) {
        const psalmText = resolvePsalmText(assignment.psalmOrCanticleId, repo);
        body.push(this.htmlPsalmAssignment(assignment, psalmText, flags, repo));
      }
    }

    const reading = resolveShortReading(hour.shortReadingRef, repo, undefined, opt("shortReading"));
    if (reading && this.includePlainProse()) body.push(htmlShortReading(reading));

    const complineResp = getComplineResponsory(repo);
    if (complineResp) {
      const hydrated = hydrateMelodies(complineResp, repo, hour.liturgicalDay, {
        ...(choices ? { choices } : {}),
        path: slotPath("compline", "responsory"),
      });
      body.push(this.htmlShortResponsoryBlock(repo, hydrated));
    } else if (this.includePlainProse()) {
      body.push(htmlPlainProse(formatComplineResponsoryFallbackPlain()));
    }

    const ndAntiphon = resolveAntiphon(hour.nuncDimittisAntiphonRef, repo, hour.liturgicalDay, opt("nuncDimittisAntiphon"));
    body.push(...this.htmlGospelCanticleSlot(repo, ndAntiphon, flags, "nuncDimittis", "nuncDimittis"));

    const prayer = resolveConcludingPrayer(hour.concludingPrayerRef, repo, undefined, opt("concludingPrayer"));
    if (prayer && this.includePlainProse()) body.push(htmlConcludingPrayer(repo, prayer.text, "compline"));

    body.push(this.htmlComplineBlessingBlock(repo, hour.liturgicalDay, choices));

    const marianAntiphon = resolveAntiphon(hour.marianAntiphonRef, repo, hour.liturgicalDay, opt("marianAntiphon"));
    if (marianAntiphon) {
      body.push(htmlSectionHeading(repo, "marianAntiphon"));
      body.push(this.htmlAntiphonBlock(repo, marianAntiphon, flags, false));
    }

    return this.joinBody(body);
  }

  /**
   * Hydrate a fixed-text slot's melody refs and emit its score mounts
   * (rubric + one score per listed part, in liturgical order). Plain markup is
   * omitted when any score was emitted — GABC lyrics are authoritative.
   */
  private htmlFixedPartBlock<T extends { melody?: DialogueMelody }>(
    fixed: T | undefined,
    repo: DataRepository,
    day: LiturgicalDay,
    choices: DayChoices | undefined,
    path: string,
    parts: (keyof DialogueMelody)[],
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
        const rubric = htmlMelodyRubric(melody);
        if (rubric) chunks.push(rubric);
      }
      chunks.push(text);
      return chunks.join("\n\n");
    }

    if (!melody) {
      if (this.isScoredOnly()) return "";
      return text;
    }

    const chunks: string[] = [];
    const rubric = htmlMelodyRubric(melody);
    if (rubric) chunks.push(rubric);
    let scored = false;
    for (const key of parts) {
      const gabc = melody[key];
      if (typeof gabc !== "string") continue;
      const line = this.emitScore(gabc);
      if (line) {
        chunks.push(line);
        scored = true;
      }
    }
    if (!scored) {
      if (this.isScoredOnly()) return "";
      chunks.push(text);
    }
    return chunks.join("\n\n");
  }

  private htmlIntroVerseBlock(
    repo: DataRepository,
    day: LiturgicalDay,
    flags: LiturgicalFlags,
    choices: DayChoices | undefined,
    hourKey: HourKey,
  ): string {
    // The concluding Halleluja is omitted in Lent, score included.
    const parts: (keyof DialogueMelody)[] = flags.alleluiaInIntroVerse
      ? ["versicle", "response", "gloria", "alleluia"]
      : ["versicle", "response", "gloria"];
    return this.htmlFixedPartBlock(
      repo.getFixedTexts()?.introductoryVerse, repo, day, choices,
      slotPath(hourKey, "introVerse"), parts,
      htmlIntroductoryVerse(repo, flags),
    );
  }

  private htmlInvitatoryVerseBlock(
    repo: DataRepository,
    day: LiturgicalDay,
    choices: DayChoices | undefined,
  ): string {
    return this.htmlFixedPartBlock(
      repo.getFixedTexts()?.invitatoryVerse, repo, day, choices,
      slotPath("invitatory", "verse"), ["versicle", "response"],
      htmlInvitatoryVerse(repo),
    );
  }

  private htmlLordsPrayerBlock(
    repo: DataRepository,
    day: LiturgicalDay,
    choices: DayChoices | undefined,
    hourKey: HourKey,
  ): string {
    return this.htmlFixedPartBlock(
      repo.getFixedTexts()?.lordsPrayer, repo, day, choices,
      slotPath(hourKey, "lordsPrayer"), ["gabc"],
      htmlLordsPrayerSection(repo),
    );
  }

  private htmlOorAcclamationBlock(
    repo: DataRepository,
    day: LiturgicalDay,
    choices: DayChoices | undefined,
    hourKey: HourKey,
  ): string {
    return this.htmlFixedPartBlock(
      repo.getFixedTexts()?.oorAcclamation, repo, day, choices,
      slotPath(hourKey, "acclamation"), ["versicle", "response"],
      htmlOorAcclamation(repo),
    );
  }

  private htmlComplineBlessingBlock(
    repo: DataRepository,
    day: LiturgicalDay,
    choices: DayChoices | undefined,
  ): string {
    return this.htmlFixedPartBlock(
      repo.getFixedTexts()?.complineBlessing, repo, day, choices,
      slotPath("compline", "blessing"), ["versicle", "response"],
      htmlComplineBlessing(repo),
    );
  }

  private htmlDismissalBlock(
    repo: DataRepository,
    day: LiturgicalDay,
    choices: DayChoices | undefined,
    hourKey: HourKey,
  ): string {
    return this.htmlFixedPartBlock(
      repo.getFixedTexts()?.dismissalWithoutMinister, repo, day, choices,
      slotPath(hourKey, "dismissal"), ["blessing", "amen"],
      htmlDismissal(repo),
    );
  }

  /** Register a GABC score, return its mount element or empty. */
  private emitScore(
    gabc: string | undefined,
    kind: "antiphon" | "psalmTone" = "antiphon",
  ): string {
    if (!this.shouldEmitScores()) return "";
    const trimmed = gabc?.trim();
    if (!trimmed) return "";

    const id = `${this.scorePrefix}-score-${++this.scoreCounter}`;
    const source = withGabcHeader(trimmed, id);
    this.scores.set(id, source);
    return kind === "psalmTone"
      ? htmlPsalmToneScoreLine(id, source)
      : htmlScoreLine(id, source);
  }

  private htmlGospelCanticleSlot(
    repo: DataRepository,
    antiphon: Antiphon | undefined,
    flags: LiturgicalFlags,
    sectionKey: SectionLabelKey,
    canticleKind: GospelCanticleKind,
  ): string[] {
    const parts: string[] = [htmlSectionHeading(repo, sectionKey)];

    if (this.isScoredOnly()) {
      if (antiphon) {
        const block = this.htmlAntiphonBlock(repo, antiphon, flags, true);
        if (block) parts.push(block);
      }
      return parts;
    }

    if (antiphon) parts.push(this.htmlAntiphonBlock(repo, antiphon, flags, true));
    parts.push(htmlGospelCanticle(repo, canticleKind));
    if (antiphon) parts.push(this.htmlAntiphonBlock(repo, antiphon, flags, false));
    return parts;
  }

  /**
   * Daytime psalmody, honouring the 1-or-3 antiphon rule (GILH 122):
   *  - a single proper antiphon is sung around all three psalms;
   *  - three proper antiphons give one per psalm;
   *  - with no proper override, each psalm keeps its assignment's antiphon.
   * Mirrors texDaytimePsalmody in texAssembler.ts.
   */
  private htmlDaytimePsalmody(
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
        const block = this.htmlAntiphonBlock(repo, antiphon, flags, true);
        return block ? [block] : [];
      }
      const parts: string[] = [this.htmlAntiphonBlock(repo, antiphon, flags, true)];
      for (const a of assignments) {
        const text = psalmText(a);
        if (text.trim()) parts.push(htmlPsalmText(text));
      }
      parts.push(this.htmlAntiphonBlock(repo, antiphon, flags, false));
      return parts;
    }

    // Otherwise per-psalm: proper antiphons when as many as the psalms, else the
    // psalm assignment's own antiphon.
    const usePerPsalmProper = Boolean(proper && proper.length === assignments.length);
    return assignments.map((a, i) => {
      const antiphon = usePerPsalmProper ? proper![i]! : a.antiphon;
      return this.htmlPsalmAssignment({ ...a, antiphon }, psalmText(a), flags, repo);
    });
  }

  private htmlAntiphonBlock(
    repo: DataRepository,
    a: Antiphon,
    flags: LiturgicalFlags,
    includePsalmTone: boolean,
  ): string {
    const rubric = htmlMelodyRubric(a.melody);

    let scoreLine = "";
    if (this.shouldEmitScores() && a.melody?.gabc) {
      scoreLine = this.emitScore(a.melody.gabc);
    }

    let toneLine = "";
    if (this.shouldEmitScores() && includePsalmTone && a.psalmTone?.trim()) {
      toneLine = this.emitScore(a.psalmTone, "psalmTone");
    }

    const hasScore = Boolean(scoreLine || toneLine);

    if (this.isScoredOnly()) {
      if (!hasScore) return "";
      const chunks: string[] = [];
      if (rubric) chunks.push(rubric);
      if (scoreLine) chunks.push(scoreLine);
      if (toneLine) chunks.push(htmlPsalmToneBlock(repo, toneLine));
      return chunks.join("\n\n");
    }

    const chunks: string[] = [];
    if (rubric) chunks.push(rubric);
    if (scoreLine) chunks.push(scoreLine);
    else chunks.push(htmlAntiphon(repo, a, flags));
    if (toneLine) chunks.push(htmlPsalmToneBlock(repo, toneLine));
    return chunks.join("\n\n");
  }

  private htmlHymnBlock(hymn: Hymn): string {
    const rubric = htmlMelodyRubric(hymn.melody);

    let scoreLine = "";
    if (this.shouldEmitScores() && hymn.melody?.gabc) {
      scoreLine = this.emitScore(hymn.melody.gabc);
    }

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
    else chunks.push(htmlHymn(hymn));
    return chunks.join("\n\n");
  }

  private htmlPsalmAssignment(
    assignment: PsalmAssignment,
    psalmText: string,
    flags: LiturgicalFlags,
    repo: DataRepository,
  ): string {
    if (this.isScoredOnly()) {
      return this.htmlAntiphonBlock(repo, assignment.antiphon, flags, true);
    }

    const open = this.htmlAntiphonBlock(repo, assignment.antiphon, flags, true);
    if (!psalmText.trim()) return open;
    const canticleMelody: string[] = [];
    if (this.shouldEmitScores()) {
      const canticle = repo.getCanticle(assignment.psalmOrCanticleId);
      if (canticle?.melody?.gabc?.trim()) {
        const rub = htmlMelodyRubric(canticle.melody);
        if (rub) canticleMelody.push(rub);
        const line = this.emitScore(canticle.melody.gabc);
        if (line) canticleMelody.push(line);
      }
    }
    const body = htmlPsalmText(psalmText);
    const close = this.htmlAntiphonBlock(repo, assignment.antiphon, flags, false);
    return [open, ...canticleMelody, body, close].join("\n\n");
  }

  private htmlShortResponsoryBlock(repo: DataRepository, r: ShortResponsory): string {
    const rubric = htmlMelodyRubric(r.melody);
    const scoreLines: string[] = [];
    if (this.shouldEmitScores()) {
      for (const gabc of [
        r.melody?.responsory,
        r.melody?.responsorySecond,
        r.melody?.versicle,
        r.melody?.gloria,
      ]) {
        const line = this.emitScore(gabc);
        if (line) scoreLines.push(line);
      }
    }

    if (this.isScoredOnly()) {
      if (scoreLines.length === 0) return "";
      const chunks: string[] = [];
      if (rubric) chunks.push(rubric);
      chunks.push(...scoreLines);
      return chunks.join("\n\n");
    }

    const chunks: string[] = [];
    if (rubric) chunks.push(rubric);
    if (scoreLines.length > 0) chunks.push(...scoreLines);
    else chunks.push(htmlShortResponsory(repo, r));
    return chunks.join("\n\n");
  }
}
