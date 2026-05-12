/**
 * Build an AbstractVespers (first or second) for a given liturgical day.
 */

import type { LiturgicalDay } from "../types/calendar.js";
import type { AbstractVespers, PsalmSlot, SlotSource } from "../types/hours.js";

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
          psalmSlot({
            kind: "fallback_chain",
            sources: [
              ...(c.seasonalKey
                ? [{ kind: "seasonal" as const, key: c.seasonalKey, field: `${vespersField}.psalmAssignments[0]` }]
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
              { kind: "psalm", id: laudatePsalms[1] ?? "psalm_116" },
            ],
          }),
          psalmSlot(laudateNtCanticle),
        ]
      : [
          psalmSlot(psalmAssignmentRef(ctx, `${vespersField}.psalmAssignments[0]`, true)),
          psalmSlot(psalmAssignmentRef(ctx, `${vespersField}.psalmAssignments[1]`, true)),
          psalmSlot(psalmAssignmentRef(ctx, `${vespersField}.psalmAssignments[2]`, true)),
        ];

  const shortReading = shortReadingRef(ctx, `${vespersField}.shortReading`);
  const shortResponsory: SlotSource = c.seasonalKey
    ? {
        kind: "fallback_chain",
        sources: [
          { kind: "seasonal", key: c.seasonalKey, field: `${vespersField}.shortResponsory` },
          { kind: "psalter", week: w, day: d, field: "vespers.shortResponsory" },
        ],
      }
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
