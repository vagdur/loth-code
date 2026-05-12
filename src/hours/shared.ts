/**
 * Helpers shared across hour builders (flags, slot context, psalm slots).
 */

import type { LiturgicalDay } from "../types/calendar.js";
import type { LiturgicalFlags, PsalmSlot, SlotSource } from "../types/hours.js";

import type { SlotContext } from "./resolver.js";

export function makeFlags(day: LiturgicalDay, teDeum: boolean): LiturgicalFlags {
  return {
    alleluiaInAntiphons: day.season === "eastertide",
    alleluiaInIntroVerse:
      day.season !== "lent" &&
      day.season !== "holy_week" &&
      day.season !== "easter_triduum",
    teDeum,
  };
}

export function makeCtx(day: LiturgicalDay): SlotContext {
  return {
    celebration: day.celebration,
    psalterWeek: day.psalterWeek,
    psalterDay: day.psalterDay,
    season: day.season,
    hymnSeries: day.psalterWeek === 1 || day.psalterWeek === 3 ? "seriesA" : "seriesB",
  };
}

export function psalmSlot(src: SlotSource): PsalmSlot {
  return { assignmentRef: src };
}
