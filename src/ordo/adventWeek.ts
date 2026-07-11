import { daysBetween } from "../calendar/computus.js";
import { getBounds } from "../calendar/liturgicalYear.js";

/** Advent week (1–4) for a date, matching liturgicalYear's advent_w{n}_* scheme. */
export function adventWeekNumber(date: Date, calendarId = "general"): number {
  const bounds = getBounds(date, calendarId);
  return Math.floor(daysBetween(date, bounds.adventStart) / 7) + 1;
}
