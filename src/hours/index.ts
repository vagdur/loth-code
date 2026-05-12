/**
 * Hour builders — public API for Layer 2.
 *
 * buildDay() is the main entry point: given a LiturgicalDay and an
 * AssemblyContext, it returns an AbstractDay containing SlotSource
 * references for every slot of every Hour.
 */

import type { AssemblyContext, LiturgicalDay } from "../types/calendar.js";
import type {
  AbstractCompline, AbstractDay, AbstractDaytimePrayer,
  AbstractLauds, AbstractOfficeOfReadings, AbstractVespers,
  LiturgicalFlags, PsalmSlot, SlotSource,
} from "../types/hours.js";
import type { PsalterWeek, Weekday } from "../types/psalter.js";
import type { SeasonalDayKey } from "../types/proper.js";

import { buildLauds } from "./buildLauds.js";
import {
  antiphonRef, biblicalReadingRef, concludingPrayerRef, hymnRef,
  intercessionsRef, marianAntiphonRef, patristicReadingRef,
  psalmAssignmentRef, shortReadingRef, SlotContext,
} from "./resolver.js";

// ---------------------------------------------------------------------------
// Shared flag builder
// ---------------------------------------------------------------------------

function makeFlags(day: LiturgicalDay, teDeum: boolean): LiturgicalFlags {
  return {
    alleluiaInAntiphons: day.season === "eastertide",
    alleluiaInIntroVerse:
      day.season !== "lent" &&
      day.season !== "holy_week" &&
      day.season !== "easter_triduum",
    teDeum,
  };
}

function makeCtx(day: LiturgicalDay): SlotContext {
  return {
    celebration: day.celebration,
    psalterWeek: day.psalterWeek,
    psalterDay: day.psalterDay,
    season: day.season,
    hymnSeries: day.psalterWeek === 1 || day.psalterWeek === 3 ? "seriesA" : "seriesB",
  };
}

function psalmSlot(src: SlotSource): PsalmSlot {
  return { assignmentRef: src };
}

// ---------------------------------------------------------------------------
// Office of Readings
// ---------------------------------------------------------------------------

function buildOfficeOfReadings(
  day: LiturgicalDay,
  context: AssemblyContext,
): AbstractOfficeOfReadings {
  const ctx = makeCtx(day);
  const { celebration: c, psalterWeek: w, psalterDay: d } = day;

  // Te Deum: said on Sundays (outside Lent), octaves of Easter/Christmas,
  // solemnities, and feasts. Not on memorias or ferial days (GILH 68).
  const teDeum =
    !["lent", "holy_week"].includes(day.season) &&
    ["sunday", "solemnity", "feast", "feast_of_lord_on_sunday"].includes(c.type);

  const flags = makeFlags(day, teDeum);

  // Hymn: OoR has two series (night/day) in Ordinary Time.
  const hymnField = context.oorSaidAtNight
    ? "officeOfReadings.hymns.night"
    : "officeOfReadings.hymns.day";
  const hymn = hymnRef({ ...ctx, hymnSeries: "seriesA" /* irrelevant; field is explicit */ }, "officeOfReadings.hymns");
  // Override with the appropriate night/day series:
  const hymnExplicit: SlotSource =
    c.source === "saint" && c.saintId
      ? {
          kind: "fallback_chain",
          sources: [
            { kind: "saint", id: c.saintId, field: "officeOfReadings.hymn" },
            ...(c.applicableCommons.map((t) => ({
              kind: "common" as const,
              type: t,
              variant: 0,
              field: hymnField,
            }))),
            { kind: "psalter", week: w, day: d, field: hymnField },
          ],
        }
      : c.seasonalKey
      ? {
          kind: "fallback_chain",
          sources: [
            { kind: "seasonal", key: c.seasonalKey, field: "officeOfReadings.hymn" },
            { kind: "psalter", week: w, day: d, field: hymnField },
          ],
        }
      : { kind: "psalter", week: w, day: d, field: hymnField };

  // Psalmody: proper on Triduum / octaves / solemnities / feasts; psalter otherwise.
  const usesProperPsalmody =
    c.type === "solemnity" ||
    c.type === "feast" ||
    c.type === "feast_of_lord_on_sunday" ||
    day.celebration.isTriduum;

  const psalmSlots: [PsalmSlot, PsalmSlot, PsalmSlot] = [
    psalmSlot(psalmAssignmentRef(ctx, "officeOfReadings.psalmAssignments[0]", usesProperPsalmody)),
    psalmSlot(psalmAssignmentRef(ctx, "officeOfReadings.psalmAssignments[1]", usesProperPsalmody)),
    psalmSlot(psalmAssignmentRef(ctx, "officeOfReadings.psalmAssignments[2]", usesProperPsalmody)),
  ];

  const versicle: SlotSource = c.seasonalKey
    ? { kind: "fallback_chain", sources: [
        { kind: "seasonal", key: c.seasonalKey, field: "officeOfReadings.versicle" },
        { kind: "psalter", week: w, day: d, field: "officeOfReadings.versicle" },
      ]}
    : { kind: "psalter", week: w, day: d, field: "officeOfReadings.versicle" };

  const biblicalReading = biblicalReadingRef(ctx, day.readingYear);
  const patristicReading = patristicReadingRef(ctx, day.readingYear);
  const concludingPrayer = concludingPrayerRef(ctx, "oor");

  // Memoria addendum (office-spec §9.2).
  const memoriaAddendum =
    c.allowMemoriaAddendum && c.saintId
      ? {
          hagiographicalReadingRef: {
            kind: "saint" as const,
            id: c.saintId,
            field: "officeOfReadings.hagiographicalReading",
          },
          concludingPrayerRef: {
            kind: "saint" as const,
            id: c.saintId,
            field: "lauds.concludingPrayer",
          },
        }
      : undefined;

  return {
    kind: "office_of_readings",
    liturgicalDay: day,
    flags,
    isFirstHour: context.oorIsFirstHour,
    hymnRef: hymnExplicit,
    psalmSlots,
    versicleRef: versicle,
    biblicalReadingRef: biblicalReading,
    patristicReadingRef: patristicReading,
    concludingPrayerRef: concludingPrayer,
    ...(memoriaAddendum ? { memoriaAddendum } : {}),
  };
}

// ---------------------------------------------------------------------------
// Vespers (first and second)
// ---------------------------------------------------------------------------

function buildVespers(
  day: LiturgicalDay,
  isFirstVespers: boolean,
): AbstractVespers {
  const ctx = makeCtx(day);
  const { celebration: c, psalterWeek: w, psalterDay: d } = day;
  const flags = makeFlags(day, false);
  const vespersField = isFirstVespers ? "firstVespers" : "vespers";

  // First Vespers of solemnities use the Laudate series (Ps 112, 116, 134, 145, 146, 147).
  // This is encoded as specific psalm IDs rather than psalter positions.
  const laudatePsalms = ["psalm_112", "psalm_116", "psalm_134", "psalm_145", "psalm_146"];
  const laudateNtCanticle: SlotSource =
    c.seasonalKey
      ? { kind: "seasonal", key: c.seasonalKey, field: `${vespersField}.psalmAssignments[2]` }
      : { kind: "psalter", week: w, day: d, field: "vespers.psalmAssignments[2]" };

  const psalmSlots: [PsalmSlot, PsalmSlot, PsalmSlot] =
    isFirstVespers && (c.type === "solemnity" || c.type === "sunday")
      ? [
          psalmSlot({ kind: "fallback_chain", sources: [
            ...(c.seasonalKey ? [{ kind: "seasonal" as const, key: c.seasonalKey, field: `${vespersField}.psalmAssignments[0]` }] : []),
            { kind: "psalm", id: laudatePsalms[0] ?? "psalm_112" },
          ]}),
          psalmSlot({ kind: "fallback_chain", sources: [
            ...(c.seasonalKey ? [{ kind: "seasonal" as const, key: c.seasonalKey, field: `${vespersField}.psalmAssignments[1]` }] : []),
            { kind: "psalm", id: laudatePsalms[1] ?? "psalm_116" },
          ]}),
          psalmSlot(laudateNtCanticle),
        ]
      : [
          psalmSlot(psalmAssignmentRef(ctx, `${vespersField}.psalmAssignments[0]`, true)),
          psalmSlot(psalmAssignmentRef(ctx, `${vespersField}.psalmAssignments[1]`, true)),
          psalmSlot(psalmAssignmentRef(ctx, `${vespersField}.psalmAssignments[2]`, true)),
        ];

  const shortReading = shortReadingRef(ctx, `${vespersField}.shortReading`);
  const shortResponsory: SlotSource = c.seasonalKey
    ? { kind: "fallback_chain", sources: [
        { kind: "seasonal", key: c.seasonalKey, field: `${vespersField}.shortResponsory` },
        { kind: "psalter", week: w, day: d, field: "vespers.shortResponsory" },
      ]}
    : { kind: "psalter", week: w, day: d, field: "vespers.shortResponsory" };

  const magnificatAntiphon = antiphonRef(
    ctx,
    `${vespersField}.magnificatAntiphon`,
    "vespers.magnificatAntiphon",
  );
  const intercessions = intercessionsRef(ctx, `${vespersField}.intercessions`);
  const concludingPrayer = concludingPrayerRef(ctx, "vespers");

  const memoriaAddendum =
    c.allowMemoriaAddendum && c.saintId
      ? {
          antiphonRef: { kind: "saint" as const, id: c.saintId, field: "vespers.magnificatAntiphon" },
          concludingPrayerRef: { kind: "saint" as const, id: c.saintId, field: "vespers.concludingPrayer" },
        }
      : undefined;

  return {
    kind: "vespers",
    isFirstVespers,
    liturgicalDay: day,
    flags,
    hymnRef: hymnRef(ctx, `${vespersField}.hymns`),
    psalmSlots,
    shortReadingRef: shortReading,
    shortResponsoryRef: shortResponsory,
    magnificatAntiphonRef: magnificatAntiphon,
    intercessionsRef: intercessions,
    concludingPrayerRef: concludingPrayer,
    ...(memoriaAddendum ? { memoriaAddendum } : {}),
  };
}

// ---------------------------------------------------------------------------
// Daytime Prayer
// ---------------------------------------------------------------------------

function buildDaytimePrayer(
  day: LiturgicalDay,
  hourKind: "terce" | "sext" | "none",
  isCurrentPsalmody: boolean,   // false → use complementary psalmody
): AbstractDaytimePrayer {
  const ctx = makeCtx(day);
  const { celebration: c, psalterWeek: w, psalterDay: d } = day;
  const flags = makeFlags(day, false);

  // Complementary psalmody or current psalmody.
  // Complementary psalmody groups are referenced by a well-known group ID
  // computed from the day of the week.
  const compGroupId = `complementary_${d.toLowerCase()}_${hourKind}`;

  const psalmSlots: [PsalmSlot, PsalmSlot, PsalmSlot] = isCurrentPsalmody
    ? [
        psalmSlot(psalmAssignmentRef(ctx, `${hourKind}.psalmAssignments[0]`, false)),
        psalmSlot(psalmAssignmentRef(ctx, `${hourKind}.psalmAssignments[1]`, false)),
        psalmSlot(psalmAssignmentRef(ctx, `${hourKind}.psalmAssignments[2]`, false)),
      ]
    : [
        psalmSlot({ kind: "fallback_chain", sources: [
            ...(c.seasonalKey ? [{ kind: "seasonal" as const, key: c.seasonalKey, field: `${hourKind}.antiphons[0]` }] : []),
            { kind: "psalter", week: w, day: d, field: `complementary.${compGroupId}[0]` },
          ]}),
        psalmSlot({ kind: "psalter", week: w, day: d, field: `complementary.${compGroupId}[1]` }),
        psalmSlot({ kind: "psalter", week: w, day: d, field: `complementary.${compGroupId}[2]` }),
      ];

  const shortReading = shortReadingRef(ctx, `${hourKind}.shortReading`);
  const versicle: SlotSource = c.seasonalKey
    ? { kind: "fallback_chain", sources: [
        { kind: "seasonal", key: c.seasonalKey, field: `${hourKind}.versicle` },
        { kind: "psalter", week: w, day: d, field: `${hourKind}.versicle` },
      ]}
    : { kind: "psalter", week: w, day: d, field: `${hourKind}.versicle` };

  const concludingPrayer: SlotSource = (() => {
    const daytimeField = `${hourKind}.concludingPrayer`;
    if (c.source === "saint" && c.saintId) {
      return { kind: "fallback_chain", sources: [
        { kind: "saint", id: c.saintId, field: daytimeField },
        { kind: "psalter", week: w, day: d, field: daytimeField },
      ]};
    }
    if (c.seasonalKey) {
      return { kind: "fallback_chain", sources: [
        { kind: "seasonal", key: c.seasonalKey, field: daytimeField },
        { kind: "psalter", week: w, day: d, field: daytimeField },
      ]};
    }
    return { kind: "psalter", week: w, day: d, field: daytimeField };
  })();

  return {
    kind: hourKind,
    liturgicalDay: day,
    flags,
    hymnRef: { kind: "psalter", week: w, day: d, field: `${hourKind}.hymn` },
    psalmSlots,
    shortReadingRef: shortReading,
    versicleRef: versicle,
    concludingPrayerRef: concludingPrayer,
  };
}

// ---------------------------------------------------------------------------
// Compline
// ---------------------------------------------------------------------------

function buildCompline(
  day: LiturgicalDay,
  context: AssemblyContext,
): AbstractCompline {
  const { psalterWeek: w, psalterDay: d } = day;
  const flags = makeFlags(day, false);

  const psalmField =
    context.complineFollows === "after_first_vespers"  ? "compline.afterFirstVespers"
    : context.complineFollows === "after_second_vespers" ? "compline.afterSecondVespers"
    : "compline.defaultPsalmAssignments";

  // Compline psalmody is always from the psalter (GILH 88).
  const numPsalms = context.complineFollows === "after_second_vespers" ? 1 : 2;
  const psalmSlots: PsalmSlot[] = Array.from({ length: numPsalms }, (_, i) =>
    psalmSlot({ kind: "psalter", week: w, day: d, field: `${psalmField}[${i}]` }),
  );

  return {
    kind: "compline",
    liturgicalDay: day,
    flags,
    hymnRef: { kind: "psalter", week: w, day: d, field: "compline.hymn" },
    psalmSlots,
    shortReadingRef: { kind: "psalter", week: w, day: d, field: "compline.shortReading" },
    nuncDimittisAntiphonRef: { kind: "psalter", week: w, day: d, field: "compline.nuncDimittisAntiphon" },
    concludingPrayerRef: { kind: "psalter", week: w, day: d, field: "compline.concludingPrayer" },
    marianAntiphonRef: marianAntiphonRef(day.season),
  };
}

// ---------------------------------------------------------------------------
// buildDay — main entry point
// ---------------------------------------------------------------------------

export function buildDay(
  day: LiturgicalDay,
  context: AssemblyContext,
): AbstractDay {
  const { daytimeHoursSaid } = context;

  // For Daytime Prayer: the "current" psalmody is used for the Hour that
  // matches the actual time of day; the others use complementary psalmody.
  // If only one Hour is said, it always uses current psalmody.
  const currentHour =
    daytimeHoursSaid.length <= 1
      ? (daytimeHoursSaid[0] ?? "sext")
      : "sext"; // default mid-day when multiple are said

  const terce = daytimeHoursSaid.includes("terce")
    ? buildDaytimePrayer(day, "terce", currentHour === "terce")
    : undefined;
  const sext = daytimeHoursSaid.includes("sext")
    ? buildDaytimePrayer(day, "sext", currentHour === "sext")
    : undefined;
  const none = daytimeHoursSaid.includes("none")
    ? buildDaytimePrayer(day, "none", currentHour === "none")
    : undefined;

  const firstVespers = day.evening.hasFirstVespers && day.evening.firstVespersCelebration
    ? buildVespers(
        { ...day, celebration: day.evening.firstVespersCelebration },
        true,
      )
    : undefined;

  return {
    liturgicalDay: day,
    context,
    invitatory: {
      kind: "invitatory",
      liturgicalDay: day,
      flags: makeFlags(day, false),
      // Psalm 94 is the default invitatory psalm; alternatives (Ps 99, 66, 23) are a
      // rubrical choice left to the assembler or user.
      psalmRef: { kind: "psalm", id: "psalm_94" },
      antiphonRef: day.celebration.seasonalKey
        ? { kind: "fallback_chain", sources: [
            { kind: "seasonal", key: day.celebration.seasonalKey, field: "invitatoryAntiphon" },
            { kind: "psalter", week: day.psalterWeek, day: day.psalterDay, field: "invitatoryAntiphon" },
          ]}
        : { kind: "psalter", week: day.psalterWeek, day: day.psalterDay, field: "invitatoryAntiphon" },
    },
    officeOfReadings: buildOfficeOfReadings(day, context),
    lauds: buildLauds(day, context),
    ...(terce ? { terce } : {}),
    ...(sext ? { sext } : {}),
    ...(none ? { none } : {}),
    ...(firstVespers ? { firstVespers } : {}),
    vespers: buildVespers(day, false),
    compline: buildCompline(day, context),
  };
}

export { buildLauds } from "./buildLauds.js";
