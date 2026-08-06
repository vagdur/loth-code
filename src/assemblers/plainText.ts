/**
 * PlainTextAssembler — renders any Hour as a plain UTF-8 string.
 *
 * This is the reference implementation: every other assembler should produce
 * the same liturgical content, just formatted differently.
 */

import type { DataRepository } from "../data/repository.js";
import { eveningVespers } from "../hours/index.js";
import type {
  AbstractCompline, AbstractDay, AbstractDaytimePrayer,
  AbstractLauds, AbstractOfficeOfReadings, AbstractVespers,
} from "../types/hours.js";
import type { LiturgicalFlags } from "../types/hours.js";
import type {
  Hymn, Intercessions, LongResponsory, PsalmAssignment,
  ShortResponsory, Versicle,
} from "../types/texts.js";
import type { Assembler, ResolveOptions } from "./types.js";
import { hydrateMelodies } from "../data/melodyResolver.js";
import type { DayChoices } from "../types/options.js";
import type { HourKey } from "../options/slotTable.js";
import { slotPath } from "../options/slotTable.js";
import {
  formatComplineBlessingPlain, formatComplineResponsoryFallbackPlain,
  formatDismissalPlain, formatExaminationOfConsciencePlain,
  formatGospelCanticlePlain, formatIntroductoryVersePlain,
  formatInvitatoryVersePlain, formatLordsPrayerPlain, formatOorAcclamationPlain,
  formatTeDeumPlain, getComplineResponsory, resolvePsalmText,
} from "./liturgicalText.js";
import {
  formatAntiphonPlain,
  formatConcludingPrayerPlain,
  formatResponseLinePlain,
  formatVersicleLinePlain,
  hourHeadingPlain,
  sectionHeadingPlain,
} from "./labels.js";
import {
  resolveAntiphon, resolveAntiphonList, resolveBiblicalReading,
  resolveConcludingPrayer, resolveHagiographicalReading, resolveHymn,
  resolveIntercessions, resolvePatristicReading, resolvePsalmAssignment,
  resolveShortReading, resolveShortResponsory, resolveVersicle,
} from "./types.js";

// ---------------------------------------------------------------------------
// Public class
// ---------------------------------------------------------------------------

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

export class PlainTextAssembler implements Assembler<string> {

  assembleDay(day: AbstractDay, repo: DataRepository, choices?: DayChoices): string {
    const parts: string[] = [
      this.assembleOfficeOfReadings(day.officeOfReadings, repo, choices),
      this.assembleLauds(day.lauds, repo, choices),
    ];
    if (day.terce) parts.push(this.assembleDaytimePrayer(day.terce, repo, choices));
    if (day.sext)  parts.push(this.assembleDaytimePrayer(day.sext, repo, choices));
    if (day.none)  parts.push(this.assembleDaytimePrayer(day.none, repo, choices));
    parts.push(this.assembleVespers(eveningVespers(day), repo, choices));
    parts.push(this.assembleCompline(day.compline, repo, choices));
    return parts.join("\n\n" + "═".repeat(60) + "\n\n");
  }

  assembleOfficeOfReadings(hour: AbstractOfficeOfReadings, repo: DataRepository, choices?: DayChoices): string {
    const { flags } = hour;
    const opt = (slot: string) => slotOpts(choices, "officeOfReadings", slot);
    const lines: string[] = [hourHeadingPlain(repo, "officeOfReadings")];

    if (hour.isFirstHour) {
      lines.push(formatInvitatoryVersePlain(repo));
    } else {
      lines.push(formatIntroductoryVersePlain(repo, flags));
    }

    const hymn = resolveHymn(hour.hymnRef, repo, hour.liturgicalDay, opt("hymn"));
    if (hymn) lines.push(renderHymn(hymn));

    for (const [i, slot] of hour.psalmSlots.entries()) {
      const assignment = resolvePsalmAssignment(slot.assignmentRef, repo, hour.liturgicalDay, opt(`psalmSlots[${i}]`));
      if (assignment) {
        const psalmText = resolvePsalmText(assignment.psalmOrCanticleId, repo);
        lines.push(renderPsalmAssignment(repo, assignment, psalmText, flags));
      }
    }

    const versicle = resolveVersicle(hour.versicleRef, repo, hour.liturgicalDay, opt("versicle"));
    if (versicle) lines.push(renderVersicle(repo, versicle));

    const biblical = resolveBiblicalReading(hour.biblicalReadingRef, repo, undefined, opt("biblicalReading"));
    if (biblical) {
      lines.push(sectionHeadingPlain(repo, "firstReading"));
      lines.push(`${biblical.reference}\n\n${biblical.text}`);
      lines.push(renderLongResponsory(repo, biblical.responsory));
    }

    const patristic = resolvePatristicReading(hour.patristicReadingRef, repo, undefined, opt("patristicReading"));
    if (patristic) {
      lines.push(sectionHeadingPlain(repo, "secondReading"));
      lines.push(`${patristic.author}, ${patristic.work}\n\n${patristic.text}`);
      lines.push(renderLongResponsory(repo, patristic.responsory));
    }

    if (hour.memoriaAddendum) {
      const hagRead = resolveHagiographicalReading(hour.memoriaAddendum.hagiographicalReadingRef, repo, undefined, opt("memoriaAddendum.hagiographicalReading"));
      if (hagRead) {
        lines.push(sectionHeadingPlain(repo, "saintReading"));
        lines.push(`${hagRead.author}, ${hagRead.work}\n\n${hagRead.text}`);
        lines.push(renderLongResponsory(repo, hagRead.responsory));
      }
      const addPrayer = resolveConcludingPrayer(hour.memoriaAddendum.concludingPrayerRef, repo, undefined, opt("memoriaAddendum.concludingPrayer"));
      if (addPrayer) lines.push(addPrayer.text);
    }

    if (flags.teDeum) {
      lines.push(sectionHeadingPlain(repo, "teDeum"));
      lines.push(formatTeDeumPlain(repo));
    }

    const prayer = resolveConcludingPrayer(hour.concludingPrayerRef, repo, undefined, opt("concludingPrayer"));
    if (prayer) lines.push(formatConcludingPrayerPlain(repo, prayer.text, "officeOfReadings"));

    lines.push(formatOorAcclamationPlain(repo));
    return lines.join("\n\n");
  }

  assembleLauds(hour: AbstractLauds, repo: DataRepository, choices?: DayChoices): string {
    const { flags } = hour;
    const opt = (slot: string) => slotOpts(choices, "lauds", slot);
    const lines: string[] = [hourHeadingPlain(repo, "lauds")];

    if (!hour.suppressIntroVerse) lines.push(formatIntroductoryVersePlain(repo, flags));

    const hymn = resolveHymn(hour.hymnRef, repo, hour.liturgicalDay, opt("hymn"));
    if (hymn) lines.push(renderHymn(hymn));

    for (const [i, slot] of hour.psalmSlots.entries()) {
      const assignment = resolvePsalmAssignment(slot.assignmentRef, repo, hour.liturgicalDay, opt(`psalmSlots[${i}]`));
      if (assignment) {
        const psalmText = resolvePsalmText(assignment.psalmOrCanticleId, repo);
        lines.push(renderPsalmAssignment(repo, assignment, psalmText, flags));
      }
    }

    const reading = resolveShortReading(hour.shortReadingRef, repo, undefined, opt("shortReading"));
    if (reading) lines.push(renderShortReading(reading));

    if (hour.shortResponsoryRef) {
      const resp = resolveShortResponsory(hour.shortResponsoryRef, repo, hour.liturgicalDay, opt("shortResponsory"));
      if (resp) lines.push(renderShortResponsory(repo, resp));
    }

    lines.push(sectionHeadingPlain(repo, "benedictus"));
    const benAntiphon = resolveAntiphon(hour.benedictusAntiphonRef, repo, hour.liturgicalDay, opt("benedictusAntiphon"));
    if (benAntiphon) lines.push(formatAntiphonPlain(repo, benAntiphon, flags));
    lines.push(formatGospelCanticlePlain(repo, "benedictus"));
    if (benAntiphon) lines.push(formatAntiphonPlain(repo, benAntiphon, flags));

    const intercessions = resolveIntercessions(hour.intercessionsRef, repo, undefined, opt("intercessions"));
    if (intercessions) lines.push(renderIntercessions(repo, intercessions));

    lines.push(formatLordsPrayerPlain(repo));

    const prayer = resolveConcludingPrayer(hour.concludingPrayerRef, repo, undefined, opt("concludingPrayer"));
    if (prayer) lines.push(formatConcludingPrayerPlain(repo, prayer.text, "lauds"));

    if (hour.memoriaAddendum) {
      const addAntiphon = resolveAntiphon(hour.memoriaAddendum.antiphonRef, repo, hour.liturgicalDay, opt("memoriaAddendum.antiphon"));
      const addPrayer = resolveConcludingPrayer(hour.memoriaAddendum.concludingPrayerRef, repo, undefined, opt("memoriaAddendum.concludingPrayer"));
      if (addAntiphon) lines.push(formatAntiphonPlain(repo, addAntiphon, flags));
      if (addPrayer) lines.push(addPrayer.text);
    }

    lines.push(formatDismissalPlain(repo));
    return lines.join("\n\n");
  }

  assembleDaytimePrayer(hour: AbstractDaytimePrayer, repo: DataRepository, choices?: DayChoices): string {
    const hourKey = hour.kind as "terce" | "sext" | "none";
    const { flags } = hour;
    const opt = (slot: string) => slotOpts(choices, hourKey, slot);
    const lines: string[] = [hourHeadingPlain(repo, hourKey)];

    lines.push(formatIntroductoryVersePlain(repo, flags));

    const hymn = resolveHymn(hour.hymnRef, repo, hour.liturgicalDay, opt("hymn"));
    if (hymn) lines.push(renderHymn(hymn));

    for (const line of renderDaytimePsalmodyPlain(repo, hour, flags, choices)) {
      lines.push(line);
    }

    const reading = resolveShortReading(hour.shortReadingRef, repo, undefined, opt("shortReading"));
    if (reading) lines.push(renderShortReading(reading));

    const versicle = resolveVersicle(hour.versicleRef, repo, hour.liturgicalDay, opt("versicle"));
    if (versicle) lines.push(renderVersicle(repo, versicle));

    const prayer = resolveConcludingPrayer(hour.concludingPrayerRef, repo, undefined, opt("concludingPrayer"));
    if (prayer) lines.push(formatConcludingPrayerPlain(repo, prayer.text, hourKey));

    lines.push(formatOorAcclamationPlain(repo));
    return lines.join("\n\n");
  }

  assembleVespers(hour: AbstractVespers, repo: DataRepository, choices?: DayChoices): string {
    const hourKey = hour.isFirstVespers ? "firstVespers" : "vespers";
    const { flags } = hour;
    const opt = (slot: string) => slotOpts(choices, hourKey, slot);
    const lines: string[] = [hourHeadingPlain(repo, hourKey)];

    lines.push(formatIntroductoryVersePlain(repo, flags));

    const hymn = resolveHymn(hour.hymnRef, repo, hour.liturgicalDay, opt("hymn"));
    if (hymn) lines.push(renderHymn(hymn));

    for (const [i, slot] of hour.psalmSlots.entries()) {
      const assignment = resolvePsalmAssignment(slot.assignmentRef, repo, hour.liturgicalDay, opt(`psalmSlots[${i}]`));
      if (assignment) {
        const psalmText = resolvePsalmText(assignment.psalmOrCanticleId, repo);
        lines.push(renderPsalmAssignment(repo, assignment, psalmText, flags));
      }
    }

    const reading = resolveShortReading(hour.shortReadingRef, repo, undefined, opt("shortReading"));
    if (reading) lines.push(renderShortReading(reading));

    if (hour.shortResponsoryRef) {
      const resp = resolveShortResponsory(hour.shortResponsoryRef, repo, hour.liturgicalDay, opt("shortResponsory"));
      if (resp) lines.push(renderShortResponsory(repo, resp));
    }

    lines.push(sectionHeadingPlain(repo, "magnificat"));
    const magAntiphon = resolveAntiphon(hour.magnificatAntiphonRef, repo, hour.liturgicalDay, opt("magnificatAntiphon"));
    if (magAntiphon) lines.push(formatAntiphonPlain(repo, magAntiphon, flags));
    lines.push(formatGospelCanticlePlain(repo, "magnificat"));
    if (magAntiphon) lines.push(formatAntiphonPlain(repo, magAntiphon, flags));

    const intercessions = resolveIntercessions(hour.intercessionsRef, repo, undefined, opt("intercessions"));
    if (intercessions) lines.push(renderIntercessions(repo, intercessions));

    lines.push(formatLordsPrayerPlain(repo));

    const prayer = resolveConcludingPrayer(hour.concludingPrayerRef, repo, undefined, opt("concludingPrayer"));
    if (prayer) lines.push(formatConcludingPrayerPlain(repo, prayer.text, hourKey));

    if (hour.memoriaAddendum) {
      const addAntiphon = resolveAntiphon(hour.memoriaAddendum.antiphonRef, repo, hour.liturgicalDay, opt("memoriaAddendum.antiphon"));
      const addPrayer = resolveConcludingPrayer(hour.memoriaAddendum.concludingPrayerRef, repo, undefined, opt("memoriaAddendum.concludingPrayer"));
      if (addAntiphon) lines.push(formatAntiphonPlain(repo, addAntiphon, flags));
      if (addPrayer) lines.push(addPrayer.text);
    }

    lines.push(formatDismissalPlain(repo));
    return lines.join("\n\n");
  }

  assembleCompline(hour: AbstractCompline, repo: DataRepository, choices?: DayChoices): string {
    const { flags } = hour;
    const opt = (slot: string) => slotOpts(choices, "compline", slot);
    const lines: string[] = [hourHeadingPlain(repo, "compline")];

    lines.push(formatIntroductoryVersePlain(repo, flags));
    lines.push(formatExaminationOfConsciencePlain(repo));

    const hymn = resolveHymn(hour.hymnRef, repo, hour.liturgicalDay, opt("hymn"));
    if (hymn) lines.push(renderHymn(hymn));

    for (const [i, slot] of hour.psalmSlots.entries()) {
      const assignment = resolvePsalmAssignment(slot.assignmentRef, repo, hour.liturgicalDay, opt(`psalmSlots[${i}]`));
      if (assignment) {
        const psalmText = resolvePsalmText(assignment.psalmOrCanticleId, repo);
        lines.push(renderPsalmAssignment(repo, assignment, psalmText, flags));
      }
    }

    const reading = resolveShortReading(hour.shortReadingRef, repo, undefined, opt("shortReading"));
    if (reading) lines.push(renderShortReading(reading));

    const complineResp = getComplineResponsory(repo);
    lines.push(
      complineResp
        ? renderShortResponsory(
            repo,
            hydrateMelodies(complineResp, repo, hour.liturgicalDay, {
              ...(choices ? { choices } : {}),
              path: slotPath("compline", "responsory"),
            }),
          )
        : formatComplineResponsoryFallbackPlain(),
    );

    lines.push(sectionHeadingPlain(repo, "nuncDimittis"));
    const ndAntiphon = resolveAntiphon(hour.nuncDimittisAntiphonRef, repo, hour.liturgicalDay, opt("nuncDimittisAntiphon"));
    if (ndAntiphon) lines.push(formatAntiphonPlain(repo, ndAntiphon, flags));
    lines.push(formatGospelCanticlePlain(repo, "nuncDimittis"));
    if (ndAntiphon) lines.push(formatAntiphonPlain(repo, ndAntiphon, flags));

    const prayer = resolveConcludingPrayer(hour.concludingPrayerRef, repo, undefined, opt("concludingPrayer"));
    if (prayer) lines.push(formatConcludingPrayerPlain(repo, prayer.text, "compline"));

    lines.push(formatComplineBlessingPlain(repo));

    const marianAntiphon = resolveAntiphon(hour.marianAntiphonRef, repo, hour.liturgicalDay, opt("marianAntiphon"));
    if (marianAntiphon) {
      lines.push(sectionHeadingPlain(repo, "marianAntiphon"));
      lines.push(formatAntiphonPlain(repo, marianAntiphon, flags));
    }

    return lines.join("\n\n");
  }
}

// ---------------------------------------------------------------------------
// Rendering helpers
// ---------------------------------------------------------------------------

/**
 * Daytime psalmody, honouring the 1-or-3 antiphon rule (GILH 122):
 *  - a single proper antiphon is sung around all three psalms;
 *  - three proper antiphons give one per psalm;
 *  - with no proper override, each psalm keeps its assignment's antiphon.
 */
export function renderDaytimePsalmodyPlain(
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
    const antiphon = formatAntiphonPlain(repo, proper[0]!, flags);
    return [antiphon, ...assignments.map(psalmText), antiphon];
  }

  // Otherwise per-psalm: proper antiphons when as many as the psalms, else the
  // psalm assignment's own antiphon.
  const usePerPsalmProper = Boolean(proper && proper.length === assignments.length);
  return assignments.map((a, i) => {
    const antiphon = usePerPsalmProper ? proper![i]! : a.antiphon;
    return renderPsalmAssignment(repo, { ...a, antiphon }, psalmText(a), flags);
  });
}

function renderHymn(hymn: Hymn): string {
  return hymn.stanzas.join("\n\n") + "\n\n" + hymn.doxology;
}

function renderPsalmAssignment(
  repo: DataRepository,
  assignment: PsalmAssignment,
  psalmText: string,
  flags: LiturgicalFlags,
): string {
  const antiphon = formatAntiphonPlain(repo, assignment.antiphon, flags);
  if (!psalmText.trim()) return antiphon;
  return `${antiphon}\n\n${psalmText}\n\n${antiphon}`;
}

function renderShortReading(r: { reference: string; text: string }): string {
  return `${r.reference}\n\n${r.text}`;
}

function renderShortResponsory(repo: DataRepository, r: ShortResponsory): string {
  return `${formatResponseLinePlain(repo, r.text)}\n${formatVersicleLinePlain(repo, r.versicle)}\n${formatResponseLinePlain(repo, r.text)}`;
}

function renderVersicle(repo: DataRepository, v: Versicle): string {
  return `${formatVersicleLinePlain(repo, v.verse)}\n${formatResponseLinePlain(repo, v.response)}`;
}

function renderLongResponsory(repo: DataRepository, r: LongResponsory): string {
  return `${formatResponseLinePlain(repo, r.text)}\n${formatVersicleLinePlain(repo, r.verse)}\n${formatResponseLinePlain(repo, r.repeatCue)}`;
}

function renderIntercessions(repo: DataRepository, i: Intercessions): string {
  const lines = [
    sectionHeadingPlain(repo, "intercessions"),
    i.introduction,
    formatResponseLinePlain(repo, i.response),
    ...i.intentions.map(
      (int) =>
        `${formatVersicleLinePlain(repo, int.firstPart)}\n${formatResponseLinePlain(repo, int.secondPart)}`,
    ),
  ];
  return lines.join("\n\n");
}
