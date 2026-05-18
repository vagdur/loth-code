/**
 * Computus — calculation of Easter Sunday (Gregorian calendar).
 * Uses the Anonymous Gregorian algorithm.
 */

/** Returns a Date object for Easter Sunday of the given year. */
export function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 1-based
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return utcDate(year, month, day);
}

// ---------------------------------------------------------------------------
// Key dates derived from Easter
// ---------------------------------------------------------------------------

export function ashWednesday(year: number): Date {
  return addDays(easterSunday(year), -46);
}

export function palmSunday(year: number): Date {
  return addDays(easterSunday(year), -7);
}

/** Holy Thursday (start of Triduum from the evening Mass onward). */
export function holyThursday(year: number): Date {
  return addDays(easterSunday(year), -3);
}

export function goodFriday(year: number): Date {
  return addDays(easterSunday(year), -2);
}

export function holySaturday(year: number): Date {
  return addDays(easterSunday(year), -1);
}

/** Ascension Thursday (39 days after Easter; some conferences move to Sunday). */
export function ascensionThursday(year: number): Date {
  return addDays(easterSunday(year), 39);
}

export function pentecost(year: number): Date {
  return addDays(easterSunday(year), 49);
}

/** Trinity Sunday — the Sunday after Pentecost (Easter + 56). */
export function trinitySunday(year: number): Date {
  return addDays(pentecost(year), 7);
}

/**
 * Corpus Christi — Thursday after Trinity Sunday (universal norm).
 * Many episcopal conferences transfer observance to the following Sunday.
 */
export function corpusChristiThursday(year: number): Date {
  return addDays(trinitySunday(year), 4);
}

/**
 * Solemnity of the Sacred Heart — Friday in the third week after Pentecost
 * (19 days after Pentecost Sunday).
 */
export function sacredHeart(year: number): Date {
  return addDays(pentecost(year), 19);
}

/** Immaculate Heart of Mary — Saturday after the Sacred Heart. */
export function immaculateHeartOfMary(year: number): Date {
  return addDays(sacredHeart(year), 1);
}

// ---------------------------------------------------------------------------
// Advent and Christmas
// ---------------------------------------------------------------------------

/**
 * First Sunday of Advent: the Sunday on or before 3 December.
 * Equivalently, the Sunday falling between 27 November and 3 December.
 */
export function firstSundayOfAdvent(year: number): Date {
  // December 3 of the liturgical year that BEGINS in civil `year`.
  const dec3 = utcDate(year, 12, 3);
  const dow = dec3.getUTCDay(); // 0 = Sunday
  return addDays(dec3, -dow);
}

/**
 * Christ the King — the Sunday before the First Sunday of Advent
 * (34th Sunday of Ordinary Time). Pass the civil year in which that Advent falls.
 */
export function christTheKing(adventCivilYear: number): Date {
  return addDays(firstSundayOfAdvent(adventCivilYear), -7);
}

/**
 * Epiphany: January 6 (universal norm).
 * Conferences that transfer it to the Sunday between Jan 2–8 must override.
 */
export function epiphany(year: number): Date {
  return utcDate(year, 1, 6);
}

/**
 * Baptism of the Lord: the Sunday after Epiphany (universal: Epiphany 6 Jan).
 * If Epiphany is already on Sunday, Baptism is the next Sunday.
 */
export function baptismOfTheLord(year: number): Date {
  const ep = epiphany(year);
  const dow = ep.getUTCDay();
  if (dow === 0) {
    return addDays(ep, 7);
  }
  return addDays(ep, 7 - dow);
}

/**
 * First Sunday of Ordinary Time (the psalter Week I anchor).
 * This is the Sunday AFTER the Baptism of the Lord.
 * (The Baptism is the last day of Christmas season; OT begins on Monday.
 * The first Sunday that falls within OT is therefore 7 days after Baptism.)
 */
export function firstOrdinaryTimeSunday(year: number): Date {
  return addDays(baptismOfTheLord(year), 7);
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/** Add (or subtract) a number of days to a Date. */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

/** Create a UTC-midnight Date from year/month(1-based)/day. */
export function utcDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

/** Days elapsed between two dates (a - b, may be negative). */
export function daysBetween(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / 86_400_000);
}
