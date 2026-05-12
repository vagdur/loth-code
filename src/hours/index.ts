/**
 * Hour builders — public API for Layer 2.
 *
 * buildDay() is the main entry point: given a LiturgicalDay and an
 * AssemblyContext, it returns an AbstractDay containing SlotSource
 * references for every slot of every Hour.
 */

import type { AssemblyContext, LiturgicalDay } from "../types/calendar.js";
import type { AbstractDay } from "../types/hours.js";

import { buildCompline } from "./buildCompline.js";
import { buildDaytimePrayer } from "./buildDaytimePrayer.js";
import { buildInvitatory } from "./buildInvitatory.js";
import { buildLauds } from "./buildLauds.js";
import { buildOfficeOfReadings } from "./buildOfficeOfReadings.js";
import { buildVespers } from "./buildVespers.js";

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
