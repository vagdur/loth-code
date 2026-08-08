/**
 * Slot resolver — builds SlotSource references (including FallbackChains)
 * for each variable slot, implementing the rules from data-structure.md §9.
 *
 * The resolver knows liturgical logic but has no access to actual text data.
 */

import type { Celebration, Season } from "../types/calendar.js";
import type { SundayCycle } from "../types/melody.js";
import type { CommonType, SeasonalDayKey } from "../types/proper.js";
import type { PsalterWeek, Weekday } from "../types/psalter.js";
import type { FallbackChain, SlotSource, SlotSourceDirect } from "../types/hours.js";

// ---------------------------------------------------------------------------
// Helpers to construct sources
// ---------------------------------------------------------------------------

function psalterSrc(week: PsalterWeek, day: Weekday, field: string): SlotSourceDirect {
  return { kind: "psalter", week, day, field };
}
function seasonalSrc(key: SeasonalDayKey, field: string): SlotSourceDirect {
  return { kind: "seasonal", key, field };
}
function saintSrc(id: string, field: string): SlotSourceDirect {
  return { kind: "saint", id, field };
}
function commonSrc(type: CommonType, variant: number, field: string): SlotSourceDirect {
  return { kind: "common", type, variant, field };
}
function fixedSrc(field: string): SlotSourceDirect {
  return { kind: "fixed", field };
}

function chain(...sources: SlotSourceDirect[]): SlotSource {
  if (sources.length === 1) return sources[0] as SlotSourceDirect;
  return { kind: "fallback_chain", sources } satisfies FallbackChain;
}

/**
 * Chain whose tail (from index `adLibFrom`) is a rubrically free choice
 * (office-spec §5.4: "otherwise from the Common or the current ferial day")
 * rather than strict precedence.  Default resolution is unchanged
 * (first-non-null), so the first resolvable tail source is the default.
 */
function adLibChain(adLibFrom: number, ...sources: SlotSourceDirect[]): SlotSource {
  if (sources.length === 1) return sources[0] as SlotSourceDirect;
  return { kind: "fallback_chain", sources, adLibFrom } satisfies FallbackChain;
}

/** Memoria arrangement (§5.4) applies — the common-vs-feria tail is ad libitum. */
export function isMemoriaCelebration(c: Celebration): boolean {
  return c.type === "obligatory_memoria" || c.type === "optional_memoria";
}

function isMemoria(c: Celebration): boolean {
  return isMemoriaCelebration(c);
}

/** Build common sources for all applicable commons in order, using the given field. */
function commonSources(
  commons: CommonType[],
  variant: number,
  field: string,
): SlotSourceDirect[] {
  return commons.map((type) => commonSrc(type, variant, field));
}

// ---------------------------------------------------------------------------
// Context parameters bundled for convenience
// ---------------------------------------------------------------------------

export interface SlotContext {
  celebration: Celebration;
  psalterWeek: PsalterWeek;
  psalterDay: Weekday;
  season: Season;
  /** Psalter hymn series: "seriesA" for Weeks I/III, "seriesB" for Weeks II/IV. */
  hymnSeries: "seriesA" | "seriesB";
}

// ---------------------------------------------------------------------------
// Hymn
// ---------------------------------------------------------------------------

export function officeOfReadingsHymnRef(
  ctx: SlotContext,
  saidAtNight: boolean,
): SlotSource {
  const { celebration: c, psalterWeek: w, psalterDay: d } = ctx;
  const hymnField = saidAtNight
    ? "officeOfReadings.hymns.night"
    : "officeOfReadings.hymns.day";

  if (c.source === "saint" && c.saintId) {
    const make = isMemoria(c) ? adLibChain.bind(null, 1) : chain;
    return make(
      saintSrc(c.saintId, "officeOfReadings.hymn"),
      ...commonSources(c.applicableCommons, 0, hymnField),
      psalterSrc(w, d, hymnField),
    );
  }
  if (c.seasonalKey) {
    return chain(
      seasonalSrc(c.seasonalKey, "officeOfReadings.hymn"),
      psalterSrc(w, d, hymnField),
    );
  }
  return psalterSrc(w, d, hymnField);
}

export function hymnRef(
  ctx: SlotContext,
  hourField: string,  // e.g. "lauds.hymns"
): SlotSource {
  const { celebration: c, psalterWeek: w, psalterDay: d, hymnSeries } = ctx;
  const psalterField = `${hourField}.${hymnSeries}`;
  // Propers (seasonal, saint, common) carry a single hymn per hour;
  // only the psalter has the week-parity HymnSet.
  const properField = hourField.replace(/\.hymns$/, ".hymn");

  if (c.source === "saint" && c.saintId) {
    const make = isMemoria(c) ? adLibChain.bind(null, 1) : chain;
    return make(
      saintSrc(c.saintId, properField),
      ...commonSources(c.applicableCommons, 0, properField),
      psalterSrc(w, d, psalterField),
    );
  }
  if (c.seasonalKey) {
    return chain(
      seasonalSrc(c.seasonalKey, properField),
      psalterSrc(w, d, psalterField),
    );
  }
  return psalterSrc(w, d, psalterField);
}

// ---------------------------------------------------------------------------
// Psalm assignments
// ---------------------------------------------------------------------------

/**
 * Psalmody for First Vespers of a solemnity.
 *
 * Same precedence as everywhere else — proper, then Common, then psalter —
 * with the psalter entry being the Sunday of the week the eve runs into. The
 * Laudate psalms that a solemnity's First Vespers normally uses are not named
 * here: they arrive with the antiphons that carry them, from the Common.
 */
export function solemnityFirstVespersPsalmAssignmentRef(
  ctx: SlotContext,
  fvWeek: PsalterWeek,
  index: 0 | 1 | 2,
): SlotSource {
  const { celebration: c } = ctx;
  const field = `firstVespers.psalmAssignments[${index}]`;
  return chain(
    ...(c.seasonalKey ? [seasonalSrc(c.seasonalKey, field)] : []),
    ...(c.saintId ? [saintSrc(c.saintId, field)] : []),
    ...commonSources(c.applicableCommons, 0, field),
    psalterSrc(fvWeek, "Sunday", field),
  );
}

export function psalmAssignmentRef(
  ctx: SlotContext,
  hourField: string,        // e.g. "lauds.psalmAssignments[0]"
  allowSaintProper = false,
): SlotSource {
  const { celebration: c, psalterWeek: w, psalterDay: d } = ctx;

  if (allowSaintProper && c.source === "saint" && c.saintId) {
    return chain(
      saintSrc(c.saintId, hourField),
      ...commonSources(c.applicableCommons, 0, hourField),
      psalterSrc(w, d, hourField),
    );
  }
  if (c.seasonalKey) {
    return chain(
      seasonalSrc(c.seasonalKey, hourField),
      psalterSrc(w, d, hourField),
    );
  }
  return psalterSrc(w, d, hourField);
}

// ---------------------------------------------------------------------------
// Short reading
// ---------------------------------------------------------------------------

/** §5.4 — Daytime Prayer on memorias: short reading from the ferial day only. */
export function ferialShortReadingRef(
  ctx: SlotContext,
  hourField: string,
): SlotSource {
  const { celebration: c, psalterWeek: w, psalterDay: d } = ctx;
  if (c.seasonalKey) {
    return chain(seasonalSrc(c.seasonalKey, hourField), psalterSrc(w, d, hourField));
  }
  return psalterSrc(w, d, hourField);
}

export function shortReadingRef(
  ctx: SlotContext,
  hourField: string,  // e.g. "lauds.shortReading"
): SlotSource {
  const { celebration: c, psalterWeek: w, psalterDay: d } = ctx;

  if (c.source === "saint" && c.saintId && !c.memoriaFullySuppressed) {
    const make = isMemoria(c) ? adLibChain.bind(null, 1) : chain;
    return make(
      saintSrc(c.saintId, hourField),
      ...commonSources(c.applicableCommons, 0, hourField),
      ...(c.seasonalKey ? [seasonalSrc(c.seasonalKey, hourField)] : []),
      psalterSrc(w, d, hourField),
    );
  }
  if (c.seasonalKey) {
    return chain(seasonalSrc(c.seasonalKey, hourField), psalterSrc(w, d, hourField));
  }
  return psalterSrc(w, d, hourField);
}

// ---------------------------------------------------------------------------
// Short responsory (Lauds / Vespers)
// ---------------------------------------------------------------------------

export function shortResponsoryRef(
  ctx: SlotContext,
  hourField: string,  // e.g. "lauds.shortResponsory"
): SlotSource {
  const { celebration: c, psalterWeek: w, psalterDay: d } = ctx;

  if (c.source === "saint" && c.saintId) {
    if (isMemoria(c)) {
      return chain(
        saintSrc(c.saintId, hourField),
        psalterSrc(w, d, hourField),
      );
    }
    return chain(
      saintSrc(c.saintId, hourField),
      ...commonSources(c.applicableCommons, 0, hourField),
      ...(c.seasonalKey ? [seasonalSrc(c.seasonalKey, hourField)] : []),
      psalterSrc(w, d, hourField),
    );
  }
  if (c.seasonalKey) {
    return chain(seasonalSrc(c.seasonalKey, hourField), psalterSrc(w, d, hourField));
  }
  return psalterSrc(w, d, hourField);
}

// ---------------------------------------------------------------------------
// Antiphon (Benedictus / Magnificat / Invitatory / Nunc Dimittis)
// ---------------------------------------------------------------------------

/**
 * Seasonal sources for a gospel-canticle antiphon: cycle field ahead of the
 * plain field, mirroring `ferialBiblicalReadingRef` for the two-year OoR
 * cycle (data-structure.md §9 / office-spec §7).
 */
function seasonalGospelAntiphonSources(
  key: SeasonalDayKey,
  field: string,
  sundayCycle: SundayCycle | undefined,
): SlotSourceDirect[] {
  if (!sundayCycle) return [seasonalSrc(key, field)];
  return [
    seasonalSrc(key, `${field}Yr${sundayCycle}`),
    seasonalSrc(key, field),
  ];
}

export function antiphonRef(
  ctx: SlotContext,
  field: string,    // e.g. "lauds.benedictusAntiphon"
  psalterField: string, // may differ from `field` for the psalter path
  /**
   * When set (Benedictus / Magnificat), prefer the seasonal
   * `…AntiphonYrA|YrB|YrC` field for `LiturgicalDay.sundayCycle` before the
   * plain antiphon. Omit for Invitatory / Nunc Dimittis.
   */
  sundayCycle?: SundayCycle,
): SlotSource {
  const { celebration: c, psalterWeek: w, psalterDay: d } = ctx;

  if (c.source === "saint" && c.saintId && !c.memoriaFullySuppressed) {
    const make = isMemoria(c) ? adLibChain.bind(null, 1) : chain;
    return make(
      saintSrc(c.saintId, field),
      ...commonSources(c.applicableCommons, 0, field),
      ...(c.seasonalKey
        ? seasonalGospelAntiphonSources(c.seasonalKey, field, sundayCycle)
        : []),
      psalterSrc(w, d, psalterField),
    );
  }
  if (c.seasonalKey) {
    return chain(
      ...seasonalGospelAntiphonSources(c.seasonalKey, field, sundayCycle),
      psalterSrc(w, d, psalterField),
    );
  }
  return psalterSrc(w, d, psalterField);
}

// ---------------------------------------------------------------------------
// Intercessions
// ---------------------------------------------------------------------------

export function intercessionsRef(
  ctx: SlotContext,
  hourField: string,   // e.g. "lauds.intercessions"
): SlotSource {
  const { celebration: c, psalterWeek: w, psalterDay: d } = ctx;

  if (c.source === "saint" && c.saintId && !c.memoriaFullySuppressed) {
    const make = isMemoria(c) ? adLibChain.bind(null, 1) : chain;
    return make(
      saintSrc(c.saintId, hourField),
      ...commonSources(c.applicableCommons, 0, hourField),
      psalterSrc(w, d, hourField),
    );
  }
  if (c.seasonalKey) {
    return chain(seasonalSrc(c.seasonalKey, hourField), psalterSrc(w, d, hourField));
  }
  return psalterSrc(w, d, hourField);
}

// ---------------------------------------------------------------------------
// Concluding prayer
// ---------------------------------------------------------------------------

/**
 * The concluding prayer source varies by Hour and day class (§6).
 *
 * For Lauds/Vespers on memorias: always the saint's prayer (no fallback to psalter).
 * For Lauds/Vespers on privileged ferials/seasons: seasonal → psalter.
 * For Lauds/Vespers on ordinary ferials: psalter.
 * For OoR: always proper (seasonal or saint).
 * For Daytime: seasonal ferials → proper; other days → psalter.
 * For Compline: always psalter.
 */
export function concludingPrayerRef(
  ctx: SlotContext,
  hourKind: "lauds" | "vespers" | "oor" | "daytime" | "compline",
): SlotSource {
  const { celebration: c, psalterWeek: w, psalterDay: d } = ctx;
  const field =
    hourKind === "lauds"    ? "lauds.concludingPrayer"
    : hourKind === "vespers" ? "vespers.concludingPrayer"
    : hourKind === "oor"    ? "officeOfReadings.concludingPrayer"
    : hourKind === "daytime" ? "terce.concludingPrayer"  // placeholder; caller specifies hour
    : "compline.concludingPrayer";

  if (hourKind === "compline") {
    return psalterSrc(w, d, "compline.concludingPrayer");
  }

  if (hourKind === "oor") {
    if (c.source === "saint" && c.saintId) {
      return chain(saintSrc(c.saintId, field), ...commonSources(c.applicableCommons, 0, field));
    }
    if (c.seasonalKey) return seasonalSrc(c.seasonalKey, field);
    return psalterSrc(w, d, field);
  }

  // Memorias: saint's prayer is always used (GILH 235c).
  if (
    c.source === "saint" && c.saintId &&
    (c.type === "obligatory_memoria" || c.type === "optional_memoria")
  ) {
    return saintSrc(c.saintId, field);
  }

  // Solemnities / feasts / privileged seasonal days.
  if (c.source === "saint" && c.saintId) {
    return chain(saintSrc(c.saintId, field), ...commonSources(c.applicableCommons, 0, field));
  }
  if (c.seasonalKey) {
    return chain(seasonalSrc(c.seasonalKey, field), psalterSrc(w, d, field));
  }
  return psalterSrc(w, d, field);
}

// ---------------------------------------------------------------------------
// Biblical / patristic readings (OoR)
// ---------------------------------------------------------------------------

/** §5.4 / §12 — scripture reading of the ferial day (Proper of Season). */
function ferialBiblicalReadingRef(
  ctx: SlotContext,
  readingYear: "I" | "II",
): SlotSource {
  const { celebration: c } = ctx;
  const yrField = readingYear === "I"
    ? "officeOfReadings.biblicalReadingYr1"
    : "officeOfReadings.biblicalReadingYr2";
  const singleField = "officeOfReadings.biblicalReading";

  if (c.seasonalKey) {
    return chain(
      seasonalSrc(c.seasonalKey, yrField),
      seasonalSrc(c.seasonalKey, singleField),
    );
  }
  return seasonalSrc("", singleField);
}

export function biblicalReadingRef(
  ctx: SlotContext,
  readingYear: "I" | "II",
): SlotSource {
  const { celebration: c } = ctx;
  const singleField = "officeOfReadings.biblicalReading";

  if (c.source === "saint" && c.saintId && isMemoriaCelebration(c)) {
    return ferialBiblicalReadingRef(ctx, readingYear);
  }
  if (c.source === "saint" && c.saintId) {
    return chain(
      saintSrc(c.saintId, singleField),
      ...commonSources(c.applicableCommons, 0, singleField),
    );
  }
  return ferialBiblicalReadingRef(ctx, readingYear);
}

/** §5.4 / §12 — patristic reading of the ferial day (Proper of Season or psalter). */
function ferialPatristicReadingRef(
  ctx: SlotContext,
  readingYear: "I" | "II",
): SlotSource {
  const { celebration: c, psalterWeek: w, psalterDay: d } = ctx;
  const yrField = readingYear === "I"
    ? "officeOfReadings.patristicReadingYr1"
    : "officeOfReadings.patristicReadingYr2";
  const singleField = "officeOfReadings.patristicReading";

  if (c.seasonalKey) {
    return chain(
      seasonalSrc(c.seasonalKey, yrField),
      seasonalSrc(c.seasonalKey, singleField),
    );
  }
  return psalterSrc(w, d, singleField);
}

function ferialPatristicTail(
  ctx: SlotContext,
  readingYear: "I" | "II",
): SlotSourceDirect[] {
  const tail = ferialPatristicReadingRef(ctx, readingYear);
  if (tail.kind === "fallback_chain") {
    return (tail as FallbackChain).sources;
  }
  return [tail as SlotSourceDirect];
}

export function patristicReadingRef(
  ctx: SlotContext,
  readingYear: "I" | "II",
): SlotSource {
  const { celebration: c, psalterWeek: w, psalterDay: d } = ctx;
  const yrField = readingYear === "I"
    ? "officeOfReadings.patristicReadingYr1"
    : "officeOfReadings.patristicReadingYr2";
  const singleField = "officeOfReadings.patristicReading";

  // §5.4 / dubium (Notitiae 12 (1976), 46): proper hagiographical only;
  // if absent, the ferial patristic reading — not the Common.
  if (
    c.source === "saint" && c.saintId &&
    (c.type === "obligatory_memoria" || c.type === "optional_memoria")
  ) {
    return chain(
      saintSrc(c.saintId, "officeOfReadings.hagiographicalReading"),
      ...ferialPatristicTail(ctx, readingYear),
    );
  }

  if (c.source === "saint" && c.saintId) {
    return chain(
      saintSrc(c.saintId, "officeOfReadings.hagiographicalReading"),
      ...commonSources(c.applicableCommons, 0, "officeOfReadings.hagiographicalReading"),
    );
  }
  if (c.seasonalKey) {
    return chain(
      seasonalSrc(c.seasonalKey, yrField),
      seasonalSrc(c.seasonalKey, singleField),
    );
  }
  return psalterSrc(w, d, singleField); // ordinarily not in the psalter; will be undefined
}

// ---------------------------------------------------------------------------
// Marian antiphon
// ---------------------------------------------------------------------------

export function marianAntiphonRef(season: Season): SlotSource {
  const field =
    season === "eastertide"    ? "marianAntiphons.eastertide"
    : season === "advent" || season === "christmas" ? "marianAntiphons.adventThroughFeb2"
    : "marianAntiphons.ordinaryTime"; // simplified; Feb 2 crossover handled separately
  return fixedSrc(field);
}

// ---------------------------------------------------------------------------
// Season-scoped daytime-prayer defaults
// ---------------------------------------------------------------------------

/**
 * Coarse fallback keys for daytime-prayer propers that a whole season shares,
 * most specific first: the weekday-specific season default (Eastertide varies
 * by weekday), then the weekday-invariant season default (Advent and Lent are
 * the same every day). These are distinct from real per-day keys and are
 * consulted after the day's own proper and before the psalter.
 */
export function seasonDaytimeKeys(season: Season, weekday: Weekday): string[] {
  const wd = weekday.toLowerCase();
  return [`daytime_${season}_${wd}`, `daytime_${season}`];
}

/**
 * Daytime proper antiphons on solemnities/feasts: saint → common → seasonal
 * defaults (office-spec §5.2, §7). Memorias use ferial psalmody antiphons only.
 */
export function daytimeProperAntiphonsRef(
  ctx: SlotContext,
  hourKind: "terce" | "sext" | "none",
): SlotSource | undefined {
  const { celebration: c } = ctx;
  const field = `${hourKind}.antiphons`;
  const sources: SlotSourceDirect[] = [];

  if (c.source === "saint" && c.saintId && !isMemoriaCelebration(c)) {
    sources.push(saintSrc(c.saintId, field));
    sources.push(...commonSources(c.applicableCommons, 0, field));
  }
  if (c.seasonalKey) {
    sources.push(seasonalSrc(c.seasonalKey, field));
  }
  for (const key of seasonDaytimeKeys(ctx.season, ctx.psalterDay)) {
    sources.push(seasonalSrc(key, field));
  }
  if (sources.length === 0) return undefined;
  return chain(...sources);
}
