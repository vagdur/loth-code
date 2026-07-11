/**
 * Build an AbstractInvitatory for a given liturgical day.
 */

import type { LiturgicalDay } from "../types/calendar.js";
import type { AbstractInvitatory } from "../types/hours.js";

import { antiphonRef } from "./resolver.js";
import { makeCtx, makeFlags } from "./shared.js";

export function buildInvitatory(day: LiturgicalDay): AbstractInvitatory {
  return {
    kind: "invitatory",
    liturgicalDay: day,
    flags: makeFlags(day, false),
    // Psalm 94 is the default invitatory psalm; alternatives (Ps 99, 66, 23) are a
    // rubrical choice left to the assembler or user.
    psalmRef: { kind: "psalm", id: "psalm_94" },
    // §5.4: if proper, from the Office of the saint; otherwise from the
    // Common or the current ferial day (ad libitum on memorias).
    antiphonRef: antiphonRef(makeCtx(day), "invitatoryAntiphon", "invitatoryAntiphon"),
  };
}
