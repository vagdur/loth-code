/**
 * PlainTextAssembler — renders any Hour as a plain UTF-8 string.
 *
 * This is the reference implementation: every other assembler should produce
 * the same liturgical content, just formatted differently.
 */

import type { DataRepository } from "../data/repository.js";
import type {
  AbstractCompline, AbstractDay, AbstractDaytimePrayer,
  AbstractLauds, AbstractOfficeOfReadings, AbstractVespers,
} from "../types/hours.js";
import type { LiturgicalFlags } from "../types/hours.js";
import type {
  Hymn, Intercessions, LongResponsory, PsalmAssignment,
  ShortResponsory, Versicle,
} from "../types/texts.js";
import type { Assembler } from "./types.js";
import {
  formatComplineBlessingPlain, formatComplineResponsoryPlain,
  formatDismissalPlain, formatExaminationOfConsciencePlain,
  formatGospelCanticlePlain, formatIntroductoryVersePlain,
  formatInvitatoryVersePlain, formatLordsPrayerPlain, formatOorAcclamationPlain,
  formatTeDeumPlain, resolvePsalmText,
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
  resolveAntiphon, resolveBiblicalReading, resolveConcludingPrayer,
  resolveHagiographicalReading, resolveHymn, resolveIntercessions,
  resolvePatristicReading, resolvePsalmAssignment, resolveShortReading,
  resolveShortResponsory, resolveVersicle,
} from "./types.js";

// ---------------------------------------------------------------------------
// Public class
// ---------------------------------------------------------------------------

export class PlainTextAssembler implements Assembler<string> {

  assembleDay(day: AbstractDay, repo: DataRepository): string {
    const parts: string[] = [
      this.assembleOfficeOfReadings(day.officeOfReadings, repo),
      this.assembleLauds(day.lauds, repo),
    ];
    if (day.terce) parts.push(this.assembleDaytimePrayer(day.terce, repo));
    if (day.sext)  parts.push(this.assembleDaytimePrayer(day.sext, repo));
    if (day.none)  parts.push(this.assembleDaytimePrayer(day.none, repo));
    parts.push(this.assembleVespers(day.vespers, repo));
    parts.push(this.assembleCompline(day.compline, repo));
    return parts.join("\n\n" + "═".repeat(60) + "\n\n");
  }

  assembleOfficeOfReadings(hour: AbstractOfficeOfReadings, repo: DataRepository): string {
    const { flags } = hour;
    const lines: string[] = [hourHeadingPlain(repo, "officeOfReadings")];

    if (hour.isFirstHour) {
      lines.push(formatInvitatoryVersePlain(repo));
    } else {
      lines.push(formatIntroductoryVersePlain(repo, flags));
    }

    const hymn = resolveHymn(hour.hymnRef, repo);
    if (hymn) lines.push(renderHymn(hymn));

    for (const slot of hour.psalmSlots) {
      const assignment = resolvePsalmAssignment(slot.assignmentRef, repo);
      if (assignment) {
        const psalmText = resolvePsalmText(assignment.psalmOrCanticleId, repo);
        lines.push(renderPsalmAssignment(repo, assignment, psalmText, flags));
      }
    }

    const versicle = resolveVersicle(hour.versicleRef, repo);
    if (versicle) lines.push(renderVersicle(repo, versicle));

    const biblical = resolveBiblicalReading(hour.biblicalReadingRef, repo);
    if (biblical) {
      lines.push(sectionHeadingPlain(repo, "firstReading"));
      lines.push(`${biblical.reference}\n\n${biblical.text}`);
      lines.push(renderLongResponsory(repo, biblical.responsory));
    }

    const patristic = resolvePatristicReading(hour.patristicReadingRef, repo);
    if (patristic) {
      lines.push(sectionHeadingPlain(repo, "secondReading"));
      lines.push(`${patristic.author}, ${patristic.work}\n\n${patristic.text}`);
      lines.push(renderLongResponsory(repo, patristic.responsory));
    }

    if (hour.memoriaAddendum) {
      const hagRead = resolveHagiographicalReading(hour.memoriaAddendum.hagiographicalReadingRef, repo);
      if (hagRead) {
        lines.push(sectionHeadingPlain(repo, "saintReading"));
        lines.push(`${hagRead.author}, ${hagRead.work}\n\n${hagRead.text}`);
        lines.push(renderLongResponsory(repo, hagRead.responsory));
      }
      const addPrayer = resolveConcludingPrayer(hour.memoriaAddendum.concludingPrayerRef, repo);
      if (addPrayer) lines.push(addPrayer.text);
    }

    if (flags.teDeum) {
      lines.push(sectionHeadingPlain(repo, "teDeum"));
      lines.push(formatTeDeumPlain(repo));
    }

    const prayer = resolveConcludingPrayer(hour.concludingPrayerRef, repo);
    if (prayer) lines.push(formatConcludingPrayerPlain(repo, prayer.text, "officeOfReadings"));

    lines.push(formatOorAcclamationPlain(repo));
    return lines.join("\n\n");
  }

  assembleLauds(hour: AbstractLauds, repo: DataRepository): string {
    const { flags } = hour;
    const lines: string[] = [hourHeadingPlain(repo, "lauds")];

    if (!hour.suppressIntroVerse) lines.push(formatIntroductoryVersePlain(repo, flags));

    const hymn = resolveHymn(hour.hymnRef, repo);
    if (hymn) lines.push(renderHymn(hymn));

    for (const slot of hour.psalmSlots) {
      const assignment = resolvePsalmAssignment(slot.assignmentRef, repo);
      if (assignment) {
        const psalmText = resolvePsalmText(assignment.psalmOrCanticleId, repo);
        lines.push(renderPsalmAssignment(repo, assignment, psalmText, flags));
      }
    }

    const reading = resolveShortReading(hour.shortReadingRef, repo);
    if (reading) lines.push(renderShortReading(reading));

    if (hour.shortResponsoryRef) {
      const resp = resolveShortResponsory(hour.shortResponsoryRef, repo);
      if (resp) lines.push(renderShortResponsory(repo, resp));
    }

    lines.push(sectionHeadingPlain(repo, "benedictus"));
    const benAntiphon = resolveAntiphon(hour.benedictuAntiphonRef, repo);
    if (benAntiphon) lines.push(formatAntiphonPlain(repo, benAntiphon, flags));
    lines.push(formatGospelCanticlePlain(repo, "benedictus"));
    if (benAntiphon) lines.push(formatAntiphonPlain(repo, benAntiphon, flags));

    const intercessions = resolveIntercessions(hour.intercessionsRef, repo);
    if (intercessions) lines.push(renderIntercessions(repo, intercessions));

    lines.push(formatLordsPrayerPlain(repo));

    const prayer = resolveConcludingPrayer(hour.concludingPrayerRef, repo);
    if (prayer) lines.push(formatConcludingPrayerPlain(repo, prayer.text, "lauds"));

    if (hour.memoriaAddendum) {
      const addAntiphon = resolveAntiphon(hour.memoriaAddendum.antiphonRef, repo);
      const addPrayer = resolveConcludingPrayer(hour.memoriaAddendum.concludingPrayerRef, repo);
      if (addAntiphon) lines.push(formatAntiphonPlain(repo, addAntiphon, flags));
      if (addPrayer) lines.push(addPrayer.text);
    }

    lines.push(formatDismissalPlain(repo));
    return lines.join("\n\n");
  }

  assembleDaytimePrayer(hour: AbstractDaytimePrayer, repo: DataRepository): string {
    const hourKey = hour.kind as "terce" | "sext" | "none";
    const { flags } = hour;
    const lines: string[] = [hourHeadingPlain(repo, hourKey)];

    lines.push(formatIntroductoryVersePlain(repo, flags));

    const hymn = resolveHymn(hour.hymnRef, repo);
    if (hymn) lines.push(renderHymn(hymn));

    for (const slot of hour.psalmSlots) {
      const assignment = resolvePsalmAssignment(slot.assignmentRef, repo);
      if (assignment) {
        const psalmText = resolvePsalmText(assignment.psalmOrCanticleId, repo);
        lines.push(renderPsalmAssignment(repo, assignment, psalmText, flags));
      }
    }

    const reading = resolveShortReading(hour.shortReadingRef, repo);
    if (reading) lines.push(renderShortReading(reading));

    const versicle = resolveVersicle(hour.versicleRef, repo);
    if (versicle) lines.push(renderVersicle(repo, versicle));

    const prayer = resolveConcludingPrayer(hour.concludingPrayerRef, repo);
    if (prayer) lines.push(formatConcludingPrayerPlain(repo, prayer.text, hourKey));

    lines.push(formatOorAcclamationPlain(repo));
    return lines.join("\n\n");
  }

  assembleVespers(hour: AbstractVespers, repo: DataRepository): string {
    const hourKey = hour.isFirstVespers ? "firstVespers" : "vespers";
    const { flags } = hour;
    const lines: string[] = [hourHeadingPlain(repo, hourKey)];

    lines.push(formatIntroductoryVersePlain(repo, flags));

    const hymn = resolveHymn(hour.hymnRef, repo);
    if (hymn) lines.push(renderHymn(hymn));

    for (const slot of hour.psalmSlots) {
      const assignment = resolvePsalmAssignment(slot.assignmentRef, repo);
      if (assignment) {
        const psalmText = resolvePsalmText(assignment.psalmOrCanticleId, repo);
        lines.push(renderPsalmAssignment(repo, assignment, psalmText, flags));
      }
    }

    const reading = resolveShortReading(hour.shortReadingRef, repo);
    if (reading) lines.push(renderShortReading(reading));

    if (hour.shortResponsoryRef) {
      const resp = resolveShortResponsory(hour.shortResponsoryRef, repo);
      if (resp) lines.push(renderShortResponsory(repo, resp));
    }

    lines.push(sectionHeadingPlain(repo, "magnificat"));
    const magAntiphon = resolveAntiphon(hour.magnificatAntiphonRef, repo);
    if (magAntiphon) lines.push(formatAntiphonPlain(repo, magAntiphon, flags));
    lines.push(formatGospelCanticlePlain(repo, "magnificat"));
    if (magAntiphon) lines.push(formatAntiphonPlain(repo, magAntiphon, flags));

    const intercessions = resolveIntercessions(hour.intercessionsRef, repo);
    if (intercessions) lines.push(renderIntercessions(repo, intercessions));

    lines.push(formatLordsPrayerPlain(repo));

    const prayer = resolveConcludingPrayer(hour.concludingPrayerRef, repo);
    if (prayer) lines.push(formatConcludingPrayerPlain(repo, prayer.text, hourKey));

    if (hour.memoriaAddendum) {
      const addAntiphon = resolveAntiphon(hour.memoriaAddendum.antiphonRef, repo);
      const addPrayer = resolveConcludingPrayer(hour.memoriaAddendum.concludingPrayerRef, repo);
      if (addAntiphon) lines.push(formatAntiphonPlain(repo, addAntiphon, flags));
      if (addPrayer) lines.push(addPrayer.text);
    }

    lines.push(formatDismissalPlain(repo));
    return lines.join("\n\n");
  }

  assembleCompline(hour: AbstractCompline, repo: DataRepository): string {
    const { flags } = hour;
    const lines: string[] = [hourHeadingPlain(repo, "compline")];

    lines.push(formatIntroductoryVersePlain(repo, flags));
    lines.push(formatExaminationOfConsciencePlain(repo));

    const hymn = resolveHymn(hour.hymnRef, repo);
    if (hymn) lines.push(renderHymn(hymn));

    for (const slot of hour.psalmSlots) {
      const assignment = resolvePsalmAssignment(slot.assignmentRef, repo);
      if (assignment) {
        const psalmText = resolvePsalmText(assignment.psalmOrCanticleId, repo);
        lines.push(renderPsalmAssignment(repo, assignment, psalmText, flags));
      }
    }

    const reading = resolveShortReading(hour.shortReadingRef, repo);
    if (reading) lines.push(renderShortReading(reading));

    lines.push(formatComplineResponsoryPlain(repo));

    lines.push(sectionHeadingPlain(repo, "nuncDimittis"));
    const ndAntiphon = resolveAntiphon(hour.nuncDimittisAntiphonRef, repo);
    if (ndAntiphon) lines.push(formatAntiphonPlain(repo, ndAntiphon, flags));
    lines.push(formatGospelCanticlePlain(repo, "nuncDimittis"));
    if (ndAntiphon) lines.push(formatAntiphonPlain(repo, ndAntiphon, flags));

    const prayer = resolveConcludingPrayer(hour.concludingPrayerRef, repo);
    if (prayer) lines.push(formatConcludingPrayerPlain(repo, prayer.text, "compline"));

    lines.push(formatComplineBlessingPlain(repo));

    const marianAntiphon = resolveAntiphon(hour.marianAntiphonRef, repo);
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
