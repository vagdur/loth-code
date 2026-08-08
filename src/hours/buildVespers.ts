/**
 * Build an AbstractVespers (first or second) for a given liturgical day.
 */

import { addDays } from "../calendar/computus.js";
import { getSundayCycle } from "../calendar/liturgicalYear.js";
import type { LiturgicalDay } from "../types/calendar.js";
import type { PsalterWeek } from "../types/psalter.js";
import type { AbstractVespers, PsalmSlot, SlotSource, SlotSourceDirect } from "../types/hours.js";

import {
  antiphonRef, concludingPrayerRef, hymnRef, intercessionsRef,
  psalmAssignmentRef, shortReadingRef, shortResponsoryRef,
  solemnityFirstVespersPsalmAssignmentRef,
} from "./resolver.js";
import { makeCtx, makeFlags, psalmSlot } from "./shared.js";

/**
 * First Vespers is of tomorrow. On the Saturday before Advent the eve still
 * belongs to the ending liturgical year, so `day.sundayCycle` can disagree
 * with the Sunday being celebrated (office-spec §7). Use tomorrow's cycle for
 * gospel-canticle antiphon fields and melody condition matching on that hour.
 */
function dayForVespers(day: LiturgicalDay, isFirstVespers: boolean): LiturgicalDay {
  if (!isFirstVespers) return day;
  const sundayCycle = getSundayCycle(addDays(day.date, 1));
  return sundayCycle === day.sundayCycle ? day : { ...day, sundayCycle };
}

export function buildVespers(
  day: LiturgicalDay,
  isFirstVespers: boolean,
): AbstractVespers {
  const officeDay = dayForVespers(day, isFirstVespers);
  const ctx = makeCtx(officeDay);
  const { celebration: c, psalterWeek: w, psalterDay: d } = officeDay;
  const flags = makeFlags(officeDay, false);
  const vespersField = isFirstVespers ? "firstVespers" : "vespers";

  // First Vespers of a Sunday is stored on the SUNDAY's psalter entry
  // (`firstVespers` section), while `day` here is the eve — usually the
  // Saturday of the preceding psalter week.
  const fvWeek: PsalterWeek = d === "Saturday" ? (((w % 4) + 1) as PsalterWeek) : w;
  const fvPsalterSrc = (field: string): SlotSourceDirect => ({
    kind: "psalter", week: fvWeek, day: "Sunday", field: `firstVespers.${field}`,
  });

  const psalmSlots: [PsalmSlot, PsalmSlot, PsalmSlot] =
    isFirstVespers && c.type === "sunday"
      ? [
          psalmSlot({
            kind: "fallback_chain",
            sources: [
              ...(c.seasonalKey
                ? [{ kind: "seasonal" as const, key: c.seasonalKey, field: `${vespersField}.psalmAssignments[0]` }]
                : []),
              fvPsalterSrc("psalmAssignments[0]"),
            ],
          }),
          psalmSlot({
            kind: "fallback_chain",
            sources: [
              ...(c.seasonalKey
                ? [{ kind: "seasonal" as const, key: c.seasonalKey, field: `${vespersField}.psalmAssignments[1]` }]
                : []),
              fvPsalterSrc("psalmAssignments[1]"),
            ],
          }),
          psalmSlot({
            kind: "fallback_chain",
            sources: [
              ...(c.seasonalKey
                ? [{ kind: "seasonal" as const, key: c.seasonalKey, field: `${vespersField}.psalmAssignments[2]` }]
                : []),
              fvPsalterSrc("psalmAssignments[2]"),
            ],
          }),
        ]
      : isFirstVespers && c.type === "solemnity"
      ? [
          psalmSlot(solemnityFirstVespersPsalmAssignmentRef(ctx, fvWeek, 0)),
          psalmSlot(solemnityFirstVespersPsalmAssignmentRef(ctx, fvWeek, 1)),
          psalmSlot(solemnityFirstVespersPsalmAssignmentRef(ctx, fvWeek, 2)),
        ]
      : [
          psalmSlot(psalmAssignmentRef(ctx, `${vespersField}.psalmAssignments[0]`, true)),
          psalmSlot(psalmAssignmentRef(ctx, `${vespersField}.psalmAssignments[1]`, true)),
          psalmSlot(psalmAssignmentRef(ctx, `${vespersField}.psalmAssignments[2]`, true)),
        ];

  const isSundayFirstVespers = isFirstVespers && c.type === "sunday";
  const fvHymnSeries = fvWeek === 1 || fvWeek === 3 ? "seriesA" : "seriesB";

  const hymn: SlotSource = isSundayFirstVespers
    ? {
        kind: "fallback_chain",
        sources: [
          ...(c.seasonalKey
            ? [{ kind: "seasonal" as const, key: c.seasonalKey, field: `${vespersField}.hymn` }]
            : []),
          fvPsalterSrc(`hymns.${fvHymnSeries}`),
        ],
      }
    : hymnRef(ctx, `${vespersField}.hymns`);

  const shortReading = isSundayFirstVespers
    ? ({
        kind: "fallback_chain",
        sources: [
          ...(c.seasonalKey
            ? [{ kind: "seasonal" as const, key: c.seasonalKey, field: `${vespersField}.shortReading` }]
            : []),
          fvPsalterSrc("shortReading"),
        ],
      } satisfies SlotSource)
    : shortReadingRef(ctx, `${vespersField}.shortReading`);

  const shortResponsory: SlotSource = isSundayFirstVespers
    ? {
        kind: "fallback_chain",
        sources: [
          ...(c.seasonalKey
            ? [{ kind: "seasonal" as const, key: c.seasonalKey, field: `${vespersField}.shortResponsory` }]
            : []),
          fvPsalterSrc("shortResponsory"),
          { kind: "psalter", week: w, day: d, field: "vespers.shortResponsory" },
        ],
      }
    : shortResponsoryRef(ctx, `${vespersField}.shortResponsory`);

  // Gospel-canticle antiphon: cycle field ahead of plain (office-spec §7 /
  // editio typica altera), same shape as ferialBiblicalReadingRef.
  const magnificatAntiphon: SlotSource = isSundayFirstVespers
    ? {
        kind: "fallback_chain",
        sources: [
          ...(c.seasonalKey
            ? [
                {
                  kind: "seasonal" as const,
                  key: c.seasonalKey,
                  field: `${vespersField}.magnificatAntiphonYr${officeDay.sundayCycle}`,
                },
                {
                  kind: "seasonal" as const,
                  key: c.seasonalKey,
                  field: `${vespersField}.magnificatAntiphon`,
                },
              ]
            : []),
          fvPsalterSrc("magnificatAntiphon"),
          { kind: "psalter", week: w, day: d, field: "vespers.magnificatAntiphon" },
        ],
      }
    : antiphonRef(
        ctx,
        `${vespersField}.magnificatAntiphon`,
        "vespers.magnificatAntiphon",
        officeDay.sundayCycle,
      );
  const intercessions: SlotSource = isSundayFirstVespers
    ? fvPsalterSrc("intercessions")
    : intercessionsRef(ctx, `${vespersField}.intercessions`);
  const concludingPrayer: SlotSource = isSundayFirstVespers
    ? fvPsalterSrc("concludingPrayer")
    : concludingPrayerRef(ctx, "vespers");

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
    liturgicalDay: officeDay,
    flags,
    hymnRef: hymn,
    psalmSlots,
    shortReadingRef: shortReading,
    shortResponsoryRef: shortResponsory,
    magnificatAntiphonRef: magnificatAntiphon,
    intercessionsRef: intercessions,
    concludingPrayerRef: concludingPrayer,
    ...(memoriaAddendum ? { memoriaAddendum } : {}),
  };
}
