/**
 * Compline in the Ordo varies only by weekday (one-week series).
 * Solemnities use Sunday; the eve of a solemnity (First Vespers) uses Saturday.
 */

import type { LiturgicalDay } from "../types/calendar.js";
import type { Weekday } from "../types/psalter.js";
import type { OrdoLabels } from "../types/texts.js";

/** Which weekday's compline template applies this night (GILH 88, office-spec §5.2). */
export function complineWeekday(day: LiturgicalDay): Weekday {
  if (
    day.evening.hasFirstVespers &&
    day.evening.firstVespersCelebration?.type === "solemnity"
  ) {
    return "Saturday";
  }
  if (day.celebration.type === "solemnity") {
    return "Sunday";
  }
  return day.psalterDay;
}

export function summarizeComplineLabel(day: LiturgicalDay, labels: OrdoLabels): string {
  const weekday = complineWeekday(day);
  const dayName = labels.weekdaysDefinite[weekday] ?? weekday;
  return labels.prose.complineForWeekday.replace("{day}", dayName);
}
