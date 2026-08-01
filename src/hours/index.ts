/**
 * Hour builders — public API for Layer 2.
 *
 * buildDay() is the main entry point: given a LiturgicalDay and an
 * AssemblyContext, it returns an AbstractDay containing SlotSource
 * references for every slot of every Hour.
 */

import type { AssemblyContext, LiturgicalDay } from "../types/calendar.js";
import type { AbstractDay, AbstractVespers } from "../types/hours.js";
import type { DayChoices } from "../types/options.js";
import { PSALMODY_COMPLEMENTARY, PSALMODY_CURRENT } from "../types/options.js";

import { buildCompline } from "./buildCompline.js";
import { buildDaytimePrayer } from "./buildDaytimePrayer.js";
import { buildInvitatory } from "./buildInvitatory.js";
import { buildLauds } from "./buildLauds.js";
import { buildOfficeOfReadings } from "./buildOfficeOfReadings.js";
import { buildVespers } from "./buildVespers.js";

type DaytimeHour = "terce" | "sext" | "none";

/**
 * Which daytime hour uses current psalmody by default: the single hour said,
 * or mid-day when several are said.
 */
export function defaultCurrentDaytimeHour(
  daytimeHoursSaid: AssemblyContext["daytimeHoursSaid"],
): DaytimeHour {
  return daytimeHoursSaid.length <= 1
    ? (daytimeHoursSaid[0] ?? "sext")
    : "sext";
}

/**
 * The Vespers prayed this evening.
 *
 * When `day.firstVespers` is present, calendar resolution has already decided
 * that First Vespers of tomorrow outranks today's Vespers (office-spec §4 /
 * GILH n. 61) — e.g. Saturday before Sunday, even if the day is a memoria.
 * Callers assembling "vespers" for the evening should use this, not
 * `day.vespers` alone.
 */
export function eveningVespers(day: AbstractDay): AbstractVespers {
  return day.firstVespers ?? day.vespers;
}

export function buildDay(
  day: LiturgicalDay,
  context: AssemblyContext,
  choices?: DayChoices,
): AbstractDay {
  const { daytimeHoursSaid } = context;

  // For Daytime Prayer: the "current" psalmody is used for the Hour that
  // matches the actual time of day; the others use complementary psalmody.
  // If only one Hour is said, it always uses current psalmody.
  // Whether another daytime hour was already prayed outside this assembly
  // cannot be inferred, so a per-hour "<hour>.psalmody" choice overrides the
  // default ("current" | "complementary"). Cross-hour exclusivity (only one
  // hour a day takes current psalmody, GILH 80) is the caller's concern.
  const currentHour = defaultCurrentDaytimeHour(daytimeHoursSaid);
  const usesCurrent = (hour: DaytimeHour): boolean => {
    const chosen = choices?.[`${hour}.psalmody`];
    if (chosen === PSALMODY_CURRENT) return true;
    if (chosen === PSALMODY_COMPLEMENTARY) return false;
    return currentHour === hour;
  };

  const terce = daytimeHoursSaid.includes("terce")
    ? buildDaytimePrayer(day, "terce", usesCurrent("terce"))
    : undefined;
  const sext = daytimeHoursSaid.includes("sext")
    ? buildDaytimePrayer(day, "sext", usesCurrent("sext"))
    : undefined;
  const none = daytimeHoursSaid.includes("none")
    ? buildDaytimePrayer(day, "none", usesCurrent("none"))
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
    invitatory: buildInvitatory(day),
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
