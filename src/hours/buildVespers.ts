/**
 * Build an AbstractVespers (first or second) for a given liturgical day.
 */

import type { LiturgicalDay } from "../types/calendar.js";
import type { PsalterWeek } from "../types/psalter.js";
import type { AbstractVespers, PsalmSlot, SlotSource, SlotSourceDirect } from "../types/hours.js";

import {
  antiphonRef, concludingPrayerRef, hymnRef, intercessionsRef,
  psalmAssignmentRef, shortReadingRef,
} from "./resolver.js";
import { makeCtx, makeFlags, psalmSlot } from "./shared.js";

export function buildVespers(
  day: LiturgicalDay,
  isFirstVespers: boolean,
): AbstractVespers {
  const ctx = makeCtx(day);
  const { celebration: c, psalterWeek: w, psalterDay: d } = day;
  const flags = makeFlags(day, false);
  const vespersField = isFirstVespers ? "firstVespers" : "vespers";

  // First Vespers of a Sunday is stored on the SUNDAY's psalter entry
  // (`firstVespers` section), while `day` here is the eve — usually the
  // Saturday of the preceding psalter week.
  const fvWeek: PsalterWeek = d === "Saturday" ? (((w % 4) + 1) as PsalterWeek) : w;
  const fvPsalterSrc = (field: string): SlotSourceDirect => ({
    kind: "psalter", week: fvWeek, day: "Sunday", field: `firstVespers.${field}`,
  });

  // First Vespers of solemnities use the Laudate series (Ps 112, 116, 134, 145, 146, 147).
  // This is encoded as specific psalm IDs rather than psalter positions.
  const laudatePsalms = ["psalm_112", "psalm_116", "psalm_134", "psalm_145", "psalm_146"];
  const laudateNtCanticle: SlotSourceDirect =
    c.seasonalKey
      ? { kind: "seasonal", key: c.seasonalKey, field: `${vespersField}.psalmAssignments[2]` }
      : { kind: "psalter", week: w, day: d, field: "vespers.psalmAssignments[2]" };

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
          psalmSlot({
            kind: "fallback_chain",
            sources: [
              ...(c.seasonalKey
                ? [{ kind: "seasonal" as const, key: c.seasonalKey, field: `${vespersField}.psalmAssignments[0]` }]
                : []),
              ...(c.saintId
                ? [{ kind: "saint" as const, id: c.saintId, field: `${vespersField}.psalmAssignments[0]` }]
                : []),
              { kind: "psalm", id: laudatePsalms[0] ?? "psalm_112" },
            ],
          }),
          psalmSlot({
            kind: "fallback_chain",
            sources: [
              ...(c.seasonalKey
                ? [{ kind: "seasonal" as const, key: c.seasonalKey, field: `${vespersField}.psalmAssignments[1]` }]
                : []),
              ...(c.saintId
                ? [{ kind: "saint" as const, id: c.saintId, field: `${vespersField}.psalmAssignments[1]` }]
                : []),
              { kind: "psalm", id: laudatePsalms[1] ?? "psalm_116" },
            ],
          }),
          psalmSlot(
            c.saintId
              ? {
                  kind: "fallback_chain",
                  sources: [
                    { kind: "saint", id: c.saintId, field: `${vespersField}.psalmAssignments[2]` },
                    laudateNtCanticle,
                  ],
                }
              : laudateNtCanticle,
          ),
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

  const shortResponsory: SlotSource = {
    kind: "fallback_chain",
    sources: [
      ...(c.seasonalKey
        ? [{ kind: "seasonal" as const, key: c.seasonalKey, field: `${vespersField}.shortResponsory` }]
        : []),
      ...(isSundayFirstVespers ? [fvPsalterSrc("shortResponsory")] : []),
      { kind: "psalter", week: w, day: d, field: "vespers.shortResponsory" },
    ],
  };

  const magnificatAntiphon: SlotSource = isSundayFirstVespers
    ? {
        kind: "fallback_chain",
        sources: [
          ...(c.seasonalKey
            ? [{ kind: "seasonal" as const, key: c.seasonalKey, field: `${vespersField}.magnificatAntiphon` }]
            : []),
          fvPsalterSrc("magnificatAntiphon"),
          { kind: "psalter", week: w, day: d, field: "vespers.magnificatAntiphon" },
        ],
      }
    : antiphonRef(ctx, `${vespersField}.magnificatAntiphon`, "vespers.magnificatAntiphon");
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
    liturgicalDay: day,
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
