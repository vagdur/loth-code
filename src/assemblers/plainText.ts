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
  Antiphon, Hymn, Intercessions, LongResponsory, PsalmAssignment,
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
    const lines: string[] = [heading("OFFICE OF READINGS")];

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
        lines.push(renderPsalmAssignment(assignment, psalmText, flags));
      }
    }

    const versicle = resolveVersicle(hour.versicleRef, repo);
    if (versicle) lines.push(renderVersicle(versicle));

    const biblical = resolveBiblicalReading(hour.biblicalReadingRef, repo);
    if (biblical) {
      lines.push(subheading("FIRST READING"));
      lines.push(`${biblical.reference}\n\n${biblical.text}`);
      lines.push(renderLongResponsory(biblical.responsory));
    }

    const patristic = resolvePatristicReading(hour.patristicReadingRef, repo);
    if (patristic) {
      lines.push(subheading("SECOND READING"));
      lines.push(`${patristic.author}, ${patristic.work}\n\n${patristic.text}`);
      lines.push(renderLongResponsory(patristic.responsory));
    }

    if (hour.memoriaAddendum) {
      const hagRead = resolveHagiographicalReading(hour.memoriaAddendum.hagiographicalReadingRef, repo);
      if (hagRead) {
        lines.push(subheading("READING (commemoration of saint)"));
        lines.push(`${hagRead.author}, ${hagRead.work}\n\n${hagRead.text}`);
        lines.push(renderLongResponsory(hagRead.responsory));
      }
      const addPrayer = resolveConcludingPrayer(hour.memoriaAddendum.concludingPrayerRef, repo);
      if (addPrayer) lines.push(addPrayer.text);
    }

    if (flags.teDeum) {
      lines.push(subheading("TE DEUM"));
      lines.push(formatTeDeumPlain(repo));
    }

    const prayer = resolveConcludingPrayer(hour.concludingPrayerRef, repo);
    if (prayer) lines.push(renderConcludingPrayer(prayer.text));

    lines.push(formatOorAcclamationPlain(repo));
    return lines.join("\n\n");
  }

  assembleLauds(hour: AbstractLauds, repo: DataRepository): string {
    const { flags } = hour;
    const lines: string[] = [heading("LAUDS — MORNING PRAYER")];

    if (!hour.suppressIntroVerse) lines.push(formatIntroductoryVersePlain(repo, flags));

    const hymn = resolveHymn(hour.hymnRef, repo);
    if (hymn) lines.push(renderHymn(hymn));

    for (const slot of hour.psalmSlots) {
      const assignment = resolvePsalmAssignment(slot.assignmentRef, repo);
      if (assignment) {
        const psalmText = resolvePsalmText(assignment.psalmOrCanticleId, repo);
        lines.push(renderPsalmAssignment(assignment, psalmText, flags));
      }
    }

    const reading = resolveShortReading(hour.shortReadingRef, repo);
    if (reading) lines.push(renderShortReading(reading));

    if (hour.shortResponsoryRef) {
      const resp = resolveShortResponsory(hour.shortResponsoryRef, repo);
      if (resp) lines.push(renderShortResponsory(resp));
    }

    lines.push(subheading("BENEDICTUS"));
    const benAntiphon = resolveAntiphon(hour.benedictuAntiphonRef, repo);
    if (benAntiphon) lines.push(renderAntiphon(benAntiphon, flags));
    lines.push(formatGospelCanticlePlain(repo, "benedictus"));
    if (benAntiphon) lines.push(renderAntiphon(benAntiphon, flags));

    const intercessions = resolveIntercessions(hour.intercessionsRef, repo);
    if (intercessions) lines.push(renderIntercessions(intercessions, "morning"));

    lines.push(formatLordsPrayerPlain(repo));

    const prayer = resolveConcludingPrayer(hour.concludingPrayerRef, repo);
    if (prayer) lines.push(renderConcludingPrayer(prayer.text));

    if (hour.memoriaAddendum) {
      const addAntiphon = resolveAntiphon(hour.memoriaAddendum.antiphonRef, repo);
      const addPrayer = resolveConcludingPrayer(hour.memoriaAddendum.concludingPrayerRef, repo);
      if (addAntiphon) lines.push(renderAntiphon(addAntiphon, flags));
      if (addPrayer) lines.push(addPrayer.text);
    }

    lines.push(formatDismissalPlain(repo));
    return lines.join("\n\n");
  }

  assembleDaytimePrayer(hour: AbstractDaytimePrayer, repo: DataRepository): string {
    const label = { terce: "TERCE — BEFORE NOON", sext: "SEXT — MIDDAY", none: "NONE — AFTERNOON" }[hour.kind];
    const { flags } = hour;
    const lines: string[] = [heading(label)];

    lines.push(formatIntroductoryVersePlain(repo, flags));

    const hymn = resolveHymn(hour.hymnRef, repo);
    if (hymn) lines.push(renderHymn(hymn));

    for (const slot of hour.psalmSlots) {
      const assignment = resolvePsalmAssignment(slot.assignmentRef, repo);
      if (assignment) {
        const psalmText = resolvePsalmText(assignment.psalmOrCanticleId, repo);
        lines.push(renderPsalmAssignment(assignment, psalmText, flags));
      }
    }

    const reading = resolveShortReading(hour.shortReadingRef, repo);
    if (reading) lines.push(renderShortReading(reading));

    const versicle = resolveVersicle(hour.versicleRef, repo);
    if (versicle) lines.push(renderVersicle(versicle));

    const prayer = resolveConcludingPrayer(hour.concludingPrayerRef, repo);
    if (prayer) lines.push(renderConcludingPrayer(prayer.text));

    lines.push(formatOorAcclamationPlain(repo));
    return lines.join("\n\n");
  }

  assembleVespers(hour: AbstractVespers, repo: DataRepository): string {
    const label = hour.isFirstVespers ? "FIRST VESPERS — EVENING PRAYER" : "VESPERS — EVENING PRAYER";
    const { flags } = hour;
    const lines: string[] = [heading(label)];

    lines.push(formatIntroductoryVersePlain(repo, flags));

    const hymn = resolveHymn(hour.hymnRef, repo);
    if (hymn) lines.push(renderHymn(hymn));

    for (const slot of hour.psalmSlots) {
      const assignment = resolvePsalmAssignment(slot.assignmentRef, repo);
      if (assignment) {
        const psalmText = resolvePsalmText(assignment.psalmOrCanticleId, repo);
        lines.push(renderPsalmAssignment(assignment, psalmText, flags));
      }
    }

    const reading = resolveShortReading(hour.shortReadingRef, repo);
    if (reading) lines.push(renderShortReading(reading));

    if (hour.shortResponsoryRef) {
      const resp = resolveShortResponsory(hour.shortResponsoryRef, repo);
      if (resp) lines.push(renderShortResponsory(resp));
    }

    lines.push(subheading("MAGNIFICAT"));
    const magAntiphon = resolveAntiphon(hour.magnificatAntiphonRef, repo);
    if (magAntiphon) lines.push(renderAntiphon(magAntiphon, flags));
    lines.push(formatGospelCanticlePlain(repo, "magnificat"));
    if (magAntiphon) lines.push(renderAntiphon(magAntiphon, flags));

    const intercessions = resolveIntercessions(hour.intercessionsRef, repo);
    if (intercessions) lines.push(renderIntercessions(intercessions, "evening"));

    lines.push(formatLordsPrayerPlain(repo));

    const prayer = resolveConcludingPrayer(hour.concludingPrayerRef, repo);
    if (prayer) lines.push(renderConcludingPrayer(prayer.text));

    if (hour.memoriaAddendum) {
      const addAntiphon = resolveAntiphon(hour.memoriaAddendum.antiphonRef, repo);
      const addPrayer = resolveConcludingPrayer(hour.memoriaAddendum.concludingPrayerRef, repo);
      if (addAntiphon) lines.push(renderAntiphon(addAntiphon, flags));
      if (addPrayer) lines.push(addPrayer.text);
    }

    lines.push(formatDismissalPlain(repo));
    return lines.join("\n\n");
  }

  assembleCompline(hour: AbstractCompline, repo: DataRepository): string {
    const { flags } = hour;
    const lines: string[] = [heading("COMPLINE — NIGHT PRAYER")];

    lines.push(formatIntroductoryVersePlain(repo, flags));
    lines.push(formatExaminationOfConsciencePlain(repo));

    const hymn = resolveHymn(hour.hymnRef, repo);
    if (hymn) lines.push(renderHymn(hymn));

    for (const slot of hour.psalmSlots) {
      const assignment = resolvePsalmAssignment(slot.assignmentRef, repo);
      if (assignment) {
        const psalmText = resolvePsalmText(assignment.psalmOrCanticleId, repo);
        lines.push(renderPsalmAssignment(assignment, psalmText, flags));
      }
    }

    const reading = resolveShortReading(hour.shortReadingRef, repo);
    if (reading) lines.push(renderShortReading(reading));

    lines.push(formatComplineResponsoryPlain(repo));

    lines.push(subheading("NUNC DIMITTIS"));
    const ndAntiphon = resolveAntiphon(hour.nuncDimittisAntiphonRef, repo);
    if (ndAntiphon) lines.push(renderAntiphon(ndAntiphon, flags));
    lines.push(formatGospelCanticlePlain(repo, "nuncDimittis"));
    if (ndAntiphon) lines.push(renderAntiphon(ndAntiphon, flags));

    const prayer = resolveConcludingPrayer(hour.concludingPrayerRef, repo);
    if (prayer) lines.push(renderConcludingPrayer(prayer.text));

    lines.push(formatComplineBlessingPlain(repo));

    const marianAntiphon = resolveAntiphon(hour.marianAntiphonRef, repo);
    if (marianAntiphon) {
      lines.push(subheading("MARIAN ANTIPHON"));
      lines.push(renderAntiphon(marianAntiphon, flags));
    }

    return lines.join("\n\n");
  }
}

// ---------------------------------------------------------------------------
// Rendering helpers
// ---------------------------------------------------------------------------

function heading(text: string): string {
  const bar = "═".repeat(text.length + 4);
  return `${bar}\n  ${text}\n${bar}`;
}

function subheading(text: string): string {
  return `── ${text} ${"─".repeat(Math.max(0, 40 - text.length))}`;
}

function renderAntiphon(a: Antiphon, flags: LiturgicalFlags): string {
  const alleluia =
    flags.alleluiaInAntiphons && !a.suppressAlleluia ? " Alleluia." : "";
  return `Ant. ${a.text}${alleluia}`;
}

function renderHymn(hymn: Hymn): string {
  return hymn.stanzas.join("\n\n") + "\n\n" + hymn.doxology;
}

function renderPsalmAssignment(
  assignment: PsalmAssignment,
  psalmText: string,
  flags: LiturgicalFlags,
): string {
  const antiphon = renderAntiphon(assignment.antiphon, flags);
  return `${antiphon}\n\n${psalmText}\n\n${antiphon}`;
}

function renderShortReading(r: { reference: string; text: string }): string {
  return `${r.reference}\n\n${r.text}`;
}

function renderShortResponsory(r: ShortResponsory): string {
  return `℟. ${r.text}\n℣. ${r.versicle}\n℟. ${r.text}`;
}

function renderVersicle(v: Versicle): string {
  return `℣. ${v.verse}\n℟. ${v.response}`;
}

function renderLongResponsory(r: LongResponsory): string {
  return `℟. ${r.text}\n℣. ${r.verse}\n℟. ${r.repeatCue}`;
}

function renderIntercessions(i: Intercessions, kind: "morning" | "evening"): string {
  const lines = [
    subheading(kind === "morning" ? "INTERCESSIONS" : "INTERCESSIONS"),
    i.introduction,
    `℟. ${i.response}`,
    ...i.intentions.map((int) => `℣. ${int.firstPart}\n℟. ${int.secondPart}`),
  ];
  return lines.join("\n\n");
}

function renderConcludingPrayer(text: string): string {
  return `Let us pray.\n\n${text}`;
}
