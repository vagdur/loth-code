/**
 * Build an AbstractDaytimePrayer (Terce, Sext, or None).
 */

import type { LiturgicalDay } from "../types/calendar.js";
import type {
  AbstractDaytimePrayer, PsalmSlot, SlotSource, SlotSourceDirect,
} from "../types/hours.js";

import { psalmAssignmentRef, shortReadingRef } from "./resolver.js";
import { makeCtx, makeFlags, psalmSlot } from "./shared.js";

export function buildDaytimePrayer(
  day: LiturgicalDay,
  hourKind: "terce" | "sext" | "none",
  isCurrentPsalmody: boolean, // false → use complementary psalmody
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
        psalmSlot({ kind: "complementary", groupId: compGroupId, index: 0 }),
        psalmSlot({ kind: "complementary", groupId: compGroupId, index: 1 }),
        psalmSlot({ kind: "complementary", groupId: compGroupId, index: 2 }),
      ];

  // Proper daytime antiphons (1 or 3) override the psalmody's own antiphons;
  // the assembler decides shared-vs-per-psalm from the resolved array length.
  const properAntiphonSources: SlotSourceDirect[] = [
    ...(c.source === "saint" && c.saintId
      ? [{ kind: "saint" as const, id: c.saintId, field: `${hourKind}.antiphons` }]
      : []),
    ...(c.seasonalKey
      ? [{ kind: "seasonal" as const, key: c.seasonalKey, field: `${hourKind}.antiphons` }]
      : []),
  ];
  const properAntiphonsRef: SlotSource | undefined =
    properAntiphonSources.length === 0
      ? undefined
      : properAntiphonSources.length === 1
      ? properAntiphonSources[0]
      : { kind: "fallback_chain", sources: properAntiphonSources };

  const shortReading = shortReadingRef(ctx, `${hourKind}.shortReading`);
  const versicle: SlotSource = c.seasonalKey
    ? {
        kind: "fallback_chain",
        sources: [
          { kind: "seasonal", key: c.seasonalKey, field: `${hourKind}.versicle` },
          { kind: "psalter", week: w, day: d, field: `${hourKind}.versicle` },
        ],
      }
    : { kind: "psalter", week: w, day: d, field: `${hourKind}.versicle` };

  const concludingPrayer: SlotSource = (() => {
    const daytimeField = `${hourKind}.concludingPrayer`;
    if (c.source === "saint" && c.saintId) {
      return {
        kind: "fallback_chain",
        sources: [
          { kind: "saint", id: c.saintId, field: daytimeField },
          { kind: "psalter", week: w, day: d, field: daytimeField },
        ],
      };
    }
    if (c.seasonalKey) {
      return {
        kind: "fallback_chain",
        sources: [
          { kind: "seasonal", key: c.seasonalKey, field: daytimeField },
          { kind: "psalter", week: w, day: d, field: daytimeField },
        ],
      };
    }
    return { kind: "psalter", week: w, day: d, field: daytimeField };
  })();

  return {
    kind: hourKind,
    liturgicalDay: day,
    flags,
    hymnRef: { kind: "psalter", week: w, day: d, field: `${hourKind}.hymn` },
    psalmSlots,
    ...(properAntiphonsRef ? { properAntiphonsRef } : {}),
    shortReadingRef: shortReading,
    versicleRef: versicle,
    concludingPrayerRef: concludingPrayer,
  };
}
