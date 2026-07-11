import { christTheKing, utcDate } from "../calendar/computus.js";
import { getBounds } from "../calendar/liturgicalYear.js";

export interface DateRange {
  from: Date;
  to: Date;
}

/** Inclusive civil dates from First Sunday of Advent through Christ the King. */
export function liturgicalYearRange(yearEnd: number, calendarId = "stockholm"): DateRange {
  const mid = utcDate(yearEnd, 6, 15);
  const bounds = getBounds(mid, calendarId);
  const to = christTheKing(yearEnd);
  return { from: bounds.adventStart, to };
}

/** Iterate every UTC calendar day in [from, to] inclusive. */
export function* eachDayInRange(range: DateRange): Generator<Date> {
  const cur = new Date(range.from.getTime());
  const end = range.to.getTime();
  while (cur.getTime() <= end) {
    yield new Date(cur.getTime());
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
}
