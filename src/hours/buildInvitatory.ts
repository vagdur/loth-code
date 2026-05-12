/**
 * Build an AbstractInvitatory for a given liturgical day.
 */

import type { LiturgicalDay } from "../types/calendar.js";
import type { AbstractInvitatory } from "../types/hours.js";

import { makeFlags } from "./shared.js";

export function buildInvitatory(day: LiturgicalDay): AbstractInvitatory {
  return {
    kind: "invitatory",
    liturgicalDay: day,
    flags: makeFlags(day, false),
    // Psalm 94 is the default invitatory psalm; alternatives (Ps 99, 66, 23) are a
    // rubrical choice left to the assembler or user.
    psalmRef: { kind: "psalm", id: "psalm_94" },
    antiphonRef: day.celebration.seasonalKey
      ? {
          kind: "fallback_chain",
          sources: [
            { kind: "seasonal", key: day.celebration.seasonalKey, field: "invitatoryAntiphon" },
            { kind: "psalter", week: day.psalterWeek, day: day.psalterDay, field: "invitatoryAntiphon" },
          ],
        }
      : { kind: "psalter", week: day.psalterWeek, day: day.psalterDay, field: "invitatoryAntiphon" },
  };
}
