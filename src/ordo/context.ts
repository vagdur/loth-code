import type { AssemblyContext } from "../types/calendar.js";

/** Assembly context for Ordo summaries — OoR first hour, single daytime block. */
export function ordoContext(calendarId = "stockholm"): AssemblyContext {
  return {
    calendarId,
    daytimeHoursSaid: ["sext"],
    oorIsFirstHour: true,
    laudsFollowsOorDirectly: false,
    oorSaidAtNight: false,
    complineFollows: "after_ferial_vespers",
  };
}
