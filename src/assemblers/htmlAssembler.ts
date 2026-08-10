/**
 * HtmlAssembler — HTML output for every liturgical hour, with chant rendered in
 * the browser by @vagdur/exsurge.
 *
 * Emits semantic markup (see html/loth.css). Unlike the LaTeX path, GABC does
 * not become sibling files: each score is a node in the returned tree and also
 * travels inline in a `data-gabc` attribute, so an assembled page is
 * self-contained either way. `renderScore` in src/browser/lothChant.ts takes
 * one spec and an element and hands it to exsurge, which renders the notation
 * and wires up click-to-play.
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
import type { ChantLanguage } from "../types/melody.js";
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
import { resolveInvitatoryPsalmody } from "./invitatory.js";
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
  htmlReading,
  htmlSectionHeading,
  htmlShortReading,
  htmlShortResponsory,
  htmlTeDeum,
  htmlVersicle,
  wrapLothHtmlDocument,
  type LothHtmlDocumentOptions,
} from "./liturgicalHtml.js";
import {
  el,
  fragment,
  renderHtml,
  score,
  text,
  type AssembledHour,
  type LothNode,
  type LothScoreNode,
  type MaybeNode,
  type ScoreSpec,
} from "./tree.js";
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

export class HtmlAssembler implements Assembler<AssembledHour> {
  private readonly outputMode: HtmlOutputMode;
  private readonly documentOptions: LothHtmlDocumentOptions | undefined;
  private readonly fragmentOnly: boolean;
  private scoreCounter = 0;
  private scorePrefix = "loth";
  private specs: ScoreSpec[] = [];

  constructor(options?: HtmlAssemblerOptions) {
    this.outputMode = options?.outputMode ?? "hybrid";
    this.documentOptions = options?.document;
    this.fragmentOnly = options?.fragmentOnly ?? false;
  }

  private reset(): void {
    this.scoreCounter = 0;
    this.specs = [];
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
   * carrying the same header-normalised GABC that went into `data-gabc`.
   *
   * Superseded by the `scores` on the returned `AssembledHour`, which carries
   * the language and melody id too; kept because it is the shape the fixture
   * tests and the TeX parity check read.
   */
  getScores(): ReadonlyMap<string, string> {
    return new Map(this.specs.map((spec) => [spec.id, spec.gabc]));
  }

  /** Package a finished body as an AssembledHour. */
  private assembled(repo: DataRepository, tree: LothNode | null): AssembledHour {
    // An hour always has at least a heading; the empty text node is just so
    // `tree` is never null for a host walking it.
    const body = tree ?? text("");
    const specs = this.specs.slice();
    const { fragmentOnly, documentOptions } = this;
    return {
      tree: body,
      scores: specs,
      html(): string {
        const markup = renderHtml(body);
        if (fragmentOnly) return markup;
        // The page carries its own scores: the runtime no longer discovers
        // them by scanning, so a standalone page has to name them.
        return wrapLothHtmlDocument(repo, markup, {
          ...documentOptions,
          scores: documentOptions?.scores ?? specs,
        });
      },
    };
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

  private joinBody(body: MaybeNode[]): LothNode | null {
    return fragment(body, "\n\n");
  }

  // -------------------------------------------------------------------------
  // Public entry points — each resets score state, builds one body, wraps it.
  // assembleDay resets once and concatenates all hour bodies into one document.
  // -------------------------------------------------------------------------

  assembleDay(day: AbstractDay, repo: DataRepository, choices?: DayChoices): AssembledHour {
    this.reset();
    const bodies: MaybeNode[] = [
      htmlHourFragment("officeOfReadings", this.officeOfReadingsBody(day.officeOfReadings, repo, choices)),
      htmlHourFragment("lauds", this.laudsBody(day.lauds, repo, choices)),
    ];
    if (day.terce) bodies.push(htmlHourFragment("terce", this.daytimePrayerBody(day.terce, repo, choices)));
    if (day.sext)  bodies.push(htmlHourFragment("sext", this.daytimePrayerBody(day.sext, repo, choices)));
    if (day.none)  bodies.push(htmlHourFragment("none", this.daytimePrayerBody(day.none, repo, choices)));
    const vespers = eveningVespers(day);
    bodies.push(htmlHourFragment(
      vespers.isFirstVespers ? "firstVespers" : "vespers",
      this.vespersBody(vespers, repo, choices),
    ));
    bodies.push(htmlHourFragment("compline", this.complineBody(day.compline, repo, choices)));

    // The rule separating hours is a sibling of the articles rather than a
    // separator string, so the day is one tree like any single hour.
    const separated: MaybeNode[] = [];
    for (const hourBody of bodies.filter((b): b is LothNode => b != null)) {
      if (separated.length > 0) separated.push(el("hr", { class: "loth-page-break" }));
      separated.push(hourBody);
    }
    return this.assembled(repo, fragment(separated, "\n"));
  }

  assembleOfficeOfReadings(hour: AbstractOfficeOfReadings, repo: DataRepository, choices?: DayChoices): AssembledHour {
    this.reset();
    return this.assembled(repo, htmlHourFragment("officeOfReadings", this.officeOfReadingsBody(hour, repo, choices)));
  }

  assembleLauds(hour: AbstractLauds, repo: DataRepository, choices?: DayChoices): AssembledHour {
    this.reset();
    return this.assembled(repo, htmlHourFragment("lauds", this.laudsBody(hour, repo, choices)));
  }

  assembleDaytimePrayer(hour: AbstractDaytimePrayer, repo: DataRepository, choices?: DayChoices): AssembledHour {
    this.reset();
    return this.assembled(repo, htmlHourFragment(hour.kind, this.daytimePrayerBody(hour, repo, choices)));
  }

  assembleVespers(hour: AbstractVespers, repo: DataRepository, choices?: DayChoices): AssembledHour {
    this.reset();
    const key = hour.isFirstVespers ? "firstVespers" : "vespers";
    return this.assembled(repo, htmlHourFragment(key, this.vespersBody(hour, repo, choices)));
  }

  assembleCompline(hour: AbstractCompline, repo: DataRepository, choices?: DayChoices): AssembledHour {
    this.reset();
    return this.assembled(repo, htmlHourFragment("compline", this.complineBody(hour, repo, choices)));
  }

  // -------------------------------------------------------------------------
  // Per-hour body builders (no wrapping; register scores as they go).
  // -------------------------------------------------------------------------

  private officeOfReadingsBody(hour: AbstractOfficeOfReadings, repo: DataRepository, choices?: DayChoices): LothNode | null {
    this.startHourScores("oor");
    const { flags } = hour;
    const opt = (slot: string) => slotOpts(choices, "officeOfReadings", slot);
    const body: MaybeNode[] = [htmlHourHeading(repo, "officeOfReadings", hour.liturgicalDay)];

    if (hour.invitatory) {
      body.push(...this.htmlInvitatoryBlocks(hour.invitatory, repo, choices));
    } else {
      body.push(this.htmlIntroVerseBlock(repo, hour.liturgicalDay, flags, choices, "officeOfReadings"));
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

  private laudsBody(hour: AbstractLauds, repo: DataRepository, choices?: DayChoices): LothNode | null {
    this.startHourScores("lauds");
    const { flags } = hour;
    const opt = (slot: string) => slotOpts(choices, "lauds", slot);
    const body: MaybeNode[] = [htmlHourHeading(repo, "lauds", hour.liturgicalDay)];

    if (hour.invitatory) {
      body.push(...this.htmlInvitatoryBlocks(hour.invitatory, repo, choices));
    } else if (!hour.suppressIntroVerse) {
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

  private daytimePrayerBody(hour: AbstractDaytimePrayer, repo: DataRepository, choices?: DayChoices): LothNode | null {
    const hourKey = hour.kind;
    this.startHourScores(hourKey);
    const { flags } = hour;
    const opt = (slot: string) => slotOpts(choices, hourKey, slot);
    const body: MaybeNode[] = [htmlHourHeading(repo, hourKey, hour.liturgicalDay)];

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

  private vespersBody(hour: AbstractVespers, repo: DataRepository, choices?: DayChoices): LothNode | null {
    const hourKey: HourKey = hour.isFirstVespers ? "firstVespers" : "vespers";
    this.startHourScores(hourKey);
    const { flags } = hour;
    const opt = (slot: string) => slotOpts(choices, hourKey, slot);
    const body: MaybeNode[] = [htmlHourHeading(repo, hourKey, hour.liturgicalDay)];

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

  private complineBody(hour: AbstractCompline, repo: DataRepository, choices?: DayChoices): LothNode | null {
    this.startHourScores("compline");
    const { flags } = hour;
    const opt = (slot: string) => slotOpts(choices, "compline", slot);
    const body: MaybeNode[] = [htmlHourHeading(repo, "compline", hour.liturgicalDay)];

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
    fallback: MaybeNode,
  ): LothNode | null {
    if (!fixed) {
      if (this.isScoredOnly()) return null;
      return fallback ?? null;
    }
    const hydrated = hydrateMelodies(fixed, repo, day, {
      ...(choices ? { choices } : {}),
      path,
    });
    const melody = hydrated.melody;

    if (this.outputMode === "plain") {
      const chunks: MaybeNode[] = [];
      if (melody) chunks.push(htmlMelodyRubric(melody));
      chunks.push(fallback);
      return fragment(chunks, "\n\n");
    }

    if (!melody) {
      if (this.isScoredOnly()) return null;
      return fallback ?? null;
    }

    const chunks: MaybeNode[] = [htmlMelodyRubric(melody)];
    let scored = false;
    for (const key of parts) {
      const gabc = melody[key];
      if (typeof gabc !== "string") continue;
      const line = this.emitScore(gabc, "antiphon", melody.language, melody.id);
      if (line) {
        chunks.push(line);
        scored = true;
      }
    }
    if (!scored) {
      if (this.isScoredOnly()) return null;
      chunks.push(fallback);
    }
    return fragment(chunks, "\n\n");
  }

  private htmlIntroVerseBlock(
    repo: DataRepository,
    day: LiturgicalDay,
    flags: LiturgicalFlags,
    choices: DayChoices | undefined,
    hourKey: HourKey,
  ): LothNode | null {
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
  ): LothNode | null {
    return this.htmlFixedPartBlock(
      repo.getFixedTexts()?.invitatoryVerse, repo, day, choices,
      slotPath("invitatory", "verse"), ["versicle", "response"],
      htmlInvitatoryVerse(repo),
    );
  }

  /** office-spec §3.1 — invitatory verse + psalm with antiphon. */
  private htmlInvitatoryBlocks(
    invitatory: AbstractInvitatory,
    repo: DataRepository,
    choices?: DayChoices,
  ): MaybeNode[] {
    const parts: MaybeNode[] = [
      this.htmlInvitatoryVerseBlock(repo, invitatory.liturgicalDay, choices),
    ];
    const psalmody = resolveInvitatoryPsalmody(
      invitatory, repo, invitatory.liturgicalDay, choices,
    );
    if (psalmody) {
      parts.push(this.htmlPsalmAssignment(
        psalmody.assignment, psalmody.psalmText, invitatory.flags, repo,
      ));
    }
    return parts;
  }

  private htmlLordsPrayerBlock(
    repo: DataRepository,
    day: LiturgicalDay,
    choices: DayChoices | undefined,
    hourKey: HourKey,
  ): LothNode | null {
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
  ): LothNode | null {
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
  ): LothNode | null {
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
  ): LothNode | null {
    return this.htmlFixedPartBlock(
      repo.getFixedTexts()?.dismissalWithoutMinister, repo, day, choices,
      slotPath(hourKey, "dismissal"), ["blessing", "amen"],
      htmlDismissal(repo),
    );
  }

  /** Register a GABC score and return its node, or null if there is none. */
  private emitScore(
    gabc: string | undefined,
    kind: "antiphon" | "psalmTone" = "antiphon",
    language?: ChantLanguage,
    melodyId?: string,
  ): LothScoreNode | null {
    if (!this.shouldEmitScores()) return null;
    const trimmed = gabc?.trim();
    if (!trimmed) return null;

    const id = `${this.scorePrefix}-score-${++this.scoreCounter}`;
    const spec: ScoreSpec = {
      id,
      gabc: withGabcHeader(trimmed, id),
      ...(language ? { language } : {}),
      ...(melodyId ? { melodyId } : {}),
      ...(kind === "psalmTone" ? { psalmTone: true } : {}),
    };
    this.specs.push(spec);
    return score(spec);
  }

  private htmlGospelCanticleSlot(
    repo: DataRepository,
    antiphon: Antiphon | undefined,
    flags: LiturgicalFlags,
    sectionKey: SectionLabelKey,
    canticleKind: GospelCanticleKind,
  ): MaybeNode[] {
    const parts: MaybeNode[] = [htmlSectionHeading(repo, sectionKey)];

    if (this.isScoredOnly()) {
      if (antiphon) parts.push(this.htmlAntiphonBlock(repo, antiphon, flags, true));
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
  ): MaybeNode[] {
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
        return [this.htmlAntiphonBlock(repo, antiphon, flags, true)];
      }
      const parts: MaybeNode[] = [this.htmlAntiphonBlock(repo, antiphon, flags, true)];
      for (const a of assignments) {
        const body = psalmText(a);
        if (body.trim()) parts.push(htmlPsalmText(body));
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
  ): LothNode | null {
    const rubric = htmlMelodyRubric(a.melody);

    let scoreLine: LothScoreNode | null = null;
    if (this.shouldEmitScores() && a.melody?.gabc) {
      scoreLine = this.emitScore(a.melody.gabc, "antiphon", a.melody.language, a.melody.id);
    }

    let toneLine: LothScoreNode | null = null;
    if (this.shouldEmitScores() && includePsalmTone && a.psalmTone?.trim()) {
      toneLine = this.emitScore(a.psalmTone, "psalmTone", a.melody?.language, a.melody?.id);
    }

    if (this.isScoredOnly()) {
      if (!scoreLine && !toneLine) return null;
      return fragment([rubric, scoreLine, htmlPsalmToneBlock(repo, toneLine)], "\n\n");
    }

    return fragment(
      [
        rubric,
        scoreLine ?? htmlAntiphon(repo, a, flags),
        htmlPsalmToneBlock(repo, toneLine),
      ],
      "\n\n",
    );
  }

  private htmlHymnBlock(hymn: Hymn): LothNode | null {
    const rubric = htmlMelodyRubric(hymn.melody);

    let scoreLine: LothScoreNode | null = null;
    if (this.shouldEmitScores() && hymn.melody?.gabc) {
      scoreLine = this.emitScore(hymn.melody.gabc, "antiphon", hymn.melody.language, hymn.melody.id);
    }

    if (this.isScoredOnly()) {
      if (!scoreLine) return null;
      return fragment([rubric, scoreLine], "\n\n");
    }

    return fragment([rubric, scoreLine ?? htmlHymn(hymn)], "\n\n");
  }

  private htmlPsalmAssignment(
    assignment: PsalmAssignment,
    psalmText: string,
    flags: LiturgicalFlags,
    repo: DataRepository,
  ): LothNode | null {
    if (this.isScoredOnly()) {
      return this.htmlAntiphonBlock(repo, assignment.antiphon, flags, true);
    }

    const open = this.htmlAntiphonBlock(repo, assignment.antiphon, flags, true);
    if (!psalmText.trim()) return open;
    const canticleMelody: MaybeNode[] = [];
    if (this.shouldEmitScores()) {
      const canticle = repo.getCanticle(assignment.psalmOrCanticleId);
      if (canticle?.melody?.gabc?.trim()) {
        canticleMelody.push(htmlMelodyRubric(canticle.melody));
        canticleMelody.push(
          this.emitScore(canticle.melody.gabc, "antiphon", canticle.melody.language, canticle.melody.id),
        );
      }
    }
    const body = htmlPsalmText(psalmText);
    const close = this.htmlAntiphonBlock(repo, assignment.antiphon, flags, false);
    return fragment([open, ...canticleMelody, body, close], "\n\n");
  }

  private htmlShortResponsoryBlock(repo: DataRepository, r: ShortResponsory): LothNode | null {
    const rubric = htmlMelodyRubric(r.melody);
    const scoreLines: LothScoreNode[] = [];
    if (this.shouldEmitScores()) {
      for (const gabc of [
        r.melody?.responsory,
        r.melody?.responsorySecond,
        r.melody?.versicle,
        r.melody?.gloria,
      ]) {
        const line = this.emitScore(gabc, "antiphon", r.melody?.language, r.melody?.id);
        if (line) scoreLines.push(line);
      }
    }

    if (this.isScoredOnly()) {
      if (scoreLines.length === 0) return null;
      return fragment([rubric, ...scoreLines], "\n\n");
    }

    return fragment(
      scoreLines.length > 0
        ? [rubric, ...scoreLines]
        : [rubric, htmlShortResponsory(repo, r)],
      "\n\n",
    );
  }
}
