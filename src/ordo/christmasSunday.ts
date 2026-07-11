import { addDays } from "../calendar/computus.js";
import { getBounds, getSeason } from "../calendar/liturgicalYear.js";

/** Sundays in Christmas season from Dec 25 through `date` (inclusive). */
export function christmasSundayNumber(date: Date, calendarId = "general"): number {
  const bounds = getBounds(date, calendarId);
  let count = 0;
  for (let d = bounds.christmasStart; d <= date; d = addDays(d, 1)) {
    if (d.getUTCDay() === 0 && getSeason(d, calendarId) === "christmas") {
      count++;
    }
  }
  return count;
}
