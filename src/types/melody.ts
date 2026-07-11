/**
 * Melody references and the compiled melody store.
 *
 * Sung texts in the data tree do not embed GABC directly; they carry
 * ordered lists of `MelodyRef`s into a per-locale melody store
 * (`data/{locale}/melodies/*.yaml`) compiled from the raw extraction
 * pipeline (`raw_data/`). The inline `Melody` type (texts.ts) remains as
 * the resolved/hydrated shape and as an escape hatch for hand-authored
 * melodies with no external source.
 */

import type { DayClass, Season } from "./calendar.js";
import type { Weekday } from "./psalter.js";

/** Sunday gospel lectionary cycle (Year A/B/C). */
export type SundayCycle = "A" | "B" | "C";

/**
 * Predicate deciding whether a melody variant applies on a given day.
 * All present fields must match (AND); within a field, any listed value
 * matches (OR). An absent condition matches every day.
 */
export interface MelodyCondition {
  seasons?: Season[];
  dayClasses?: DayClass[];
  sundayCycles?: SundayCycle[];
  /** Psalter weekday (capitalized English name). */
  weekdays?: Weekday[];
  /** Inclusive month-day range "MM-DD"; may wrap the year end (e.g. 12-17 .. 01-05). */
  dateRange?: { from: string; to: string };
}

/**
 * Reference from a data-tree slot into the melody store.
 *
 * A slot carries an ordered list; resolution picks the FIRST entry whose
 * condition matches the LiturgicalDay. Unconditioned entries always match,
 * so defaults go last. Entries after the first match are free alternatives
 * ("eller:" in the KLN sources), retrievable via resolveAllMelodies.
 */
export interface MelodyRef {
  /** StoredMelody.id, or one of its aliases. */
  ref: string;
  condition?: MelodyCondition;
  /** Free-form note: "eller", "solemn tone", edition, etc. */
  note?: string;
}

export type MelodyKind =
  | "hymn"
  | "antiphon"
  | "gospel_antiphon"
  | "short_responsory"
  | "long_responsory"
  | "versicle"
  | "psalm_tone"
  | "canticle"
  | "other";

/**
 * Split GABC bodies for melodies whose source notation covers several
 * liturgical sub-sections. Keys depend on `MelodyKind`:
 *   antiphon         → { antiphon, psalmTone, antiphonPaschal? }
 *   gospel_antiphon  → { antiphon, psalmTone, firstVerse }
 *   short_responsory → { responsory, responsorySecond, versicle, gloria }
 */
export interface MelodyParts {
  antiphon?: string;
  /** Eastertide variant of the antiphon body (with appended Alleluia), when notated. */
  antiphonPaschal?: string;
  psalmTone?: string;
  /** Pointed first verse of the canticle/psalm sung to the tone. */
  firstVerse?: string;
  responsory?: string;
  responsorySecond?: string;
  versicle?: string;
  gloria?: string;
}

/** Provenance of a stored melody in the raw extraction tree. */
export interface MelodySource {
  /** Repo-relative path of the index.json the melody came from. */
  index: string;
  /** Source PDF filename, e.g. "0125-V.pdf". */
  pdf: string;
  /** Source category slug from the raw manifest. */
  sourceCategory: string;
  page: number;
  sectionLabel: string;
  variantLabel?: string;
  /** Per-melody split PDF filename, e.g. "02-Antifon-1.pdf". */
  filename: string;
}

/** One compiled melody in `data/{locale}/melodies/*.yaml`. */
export interface StoredMelody {
  /** Stable id derived from the raw split path, e.g. "kln/2023/09/M1-V/02-antifon-1". */
  id: string;
  kind: MelodyKind;
  /** Gregorian mode 1–8, when identifiable. */
  mode?: number;
  /** Full GABC body (hymns and other single-body pieces). */
  gabc?: string;
  /** Split GABC parts (antiphon+tone, responsory sections, ...). */
  parts?: MelodyParts;
  /** De-hyphenated Swedish text recovered from the GABC lyrics. */
  text?: string;
  /** Incipit from the raw metadata; sanity cross-check for `text`. */
  incipit?: string;
  /** Hash of normalized GABC content; used for rename/duplicate detection. */
  contentHash: string;
  /** When `"failed"`, the entry carries provenance only — no importable GABC. */
  status?: "failed";
  /** Ids of exact-content duplicates folded into this canonical entry. */
  aliases?: string[];
  source: MelodySource;
}
