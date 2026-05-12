/**
 * Build an AbstractCompline for a given liturgical day and assembly context.
 */

import type { AssemblyContext, LiturgicalDay } from "../types/calendar.js";
import type { AbstractCompline, PsalmSlot } from "../types/hours.js";

import { marianAntiphonRef } from "./resolver.js";
import { makeFlags, psalmSlot } from "./shared.js";

export function buildCompline(
  day: LiturgicalDay,
  context: AssemblyContext,
): AbstractCompline {
  const { psalterWeek: w, psalterDay: d } = day;
  const flags = makeFlags(day, false);

  const psalmField =
    context.complineFollows === "after_first_vespers"
      ? "compline.afterFirstVespers"
      : context.complineFollows === "after_second_vespers"
        ? "compline.afterSecondVespers"
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
