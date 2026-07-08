/**
 * Melody reference resolution — pure functions.
 *
 * Data-tree slots carry ordered `melodyRefs` lists (see types/melody.ts).
 * Resolution picks the first ref whose condition matches the LiturgicalDay
 * and hydrates the slot's inline `melody` (and `psalmTone`) fields from the
 * stored melody, so assemblers keep consuming the plain `Melody` shape.
 * When refs are present they are authoritative; an inline melody survives
 * only as the fallback when no ref matches or a ref dangles.
 */

import type { LiturgicalDay } from "../types/calendar.js";
import type {
  MelodyCondition, MelodyRef, StoredMelody,
} from "../types/melody.js";
import type { Melody, ShortResponsoryMelody } from "../types/texts.js";
import { gabcToText } from "../tools/gabcText.js";
import type { DataRepository } from "./repository.js";

// ---------------------------------------------------------------------------
// Condition matching
// ---------------------------------------------------------------------------

function monthDay(date: Date): string {
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${m}-${d}`;
}

/** All present fields must match (AND); within a field any value matches (OR). */
export function matchesCondition(
  cond: MelodyCondition | undefined,
  day: LiturgicalDay,
): boolean {
  if (!cond) return true;
  if (cond.seasons && !cond.seasons.includes(day.season)) return false;
  if (cond.dayClasses && !cond.dayClasses.includes(day.celebration.type)) return false;
  if (cond.sundayCycles && !cond.sundayCycles.includes(day.sundayCycle)) return false;
  if (cond.dateRange) {
    const { from, to } = cond.dateRange;
    const d = monthDay(day.date);
    // Inclusive; a range with from > to wraps the year end (e.g. 12-17..01-05).
    const inRange = from <= to ? d >= from && d <= to : d >= from || d <= to;
    if (!inRange) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Ref selection
// ---------------------------------------------------------------------------

/** First ref whose condition matches and whose id resolves in the store. */
export function selectMelodyRef(
  refs: MelodyRef[] | undefined,
  repo: DataRepository,
  day: LiturgicalDay,
): { ref: MelodyRef; stored: StoredMelody } | undefined {
  for (const ref of refs ?? []) {
    if (!matchesCondition(ref.condition, day)) continue;
    const stored = repo.getMelody(ref.ref);
    if (stored) return { ref, stored };
  }
  return undefined;
}

/** Every matching ref in order — the tail entries are free alternatives ("eller"). */
export function resolveAllMelodies(
  refs: MelodyRef[] | undefined,
  repo: DataRepository,
  day: LiturgicalDay,
): StoredMelody[] {
  const out: StoredMelody[] = [];
  for (const ref of refs ?? []) {
    if (!matchesCondition(ref.condition, day)) continue;
    const stored = repo.getMelody(ref.ref);
    if (stored) out.push(stored);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Hydration — StoredMelody → inline slot fields
// ---------------------------------------------------------------------------

function toInlineMelody(
  stored: StoredMelody,
  ref: MelodyRef,
  day: LiturgicalDay,
): Melody {
  const melody: Melody = {};
  if (stored.mode !== undefined) melody.mode = stored.mode;
  if (ref.note) melody.note = ref.note;
  // Antiphon-kind melodies may carry a separately notated Eastertide body.
  const paschal = day.season === "eastertide" ? stored.parts?.antiphonPaschal : undefined;
  const gabc = paschal ?? stored.parts?.antiphon ?? stored.gabc;
  if (gabc) melody.gabc = gabc;
  return melody;
}

function toShortResponsoryMelody(
  stored: StoredMelody,
  ref: MelodyRef,
): ShortResponsoryMelody {
  const melody: ShortResponsoryMelody = {};
  if (stored.mode !== undefined) melody.mode = stored.mode;
  if (ref.note) melody.note = ref.note;
  const p = stored.parts ?? {};
  if (p.responsory) melody.responsory = p.responsory;
  if (p.responsorySecond) melody.responsorySecond = p.responsorySecond;
  if (p.versicle) melody.versicle = p.versicle;
  if (p.gloria) melody.gloria = p.gloria;
  return melody;
}

/** A slot object carrying melody refs (structural check, not a full type test). */
interface MelodyRefCarrier {
  melodyRefs?: MelodyRef[];
  melody?: unknown;
  psalmTone?: string;
  text?: string;
  versicle?: string;
  stanzas?: string[];
}

function hydrateCarrier(
  carrier: MelodyRefCarrier,
  repo: DataRepository,
  day: LiturgicalDay,
): MelodyRefCarrier {
  const selected = selectMelodyRef(carrier.melodyRefs, repo, day);
  if (!selected) return carrier; // dangling or nothing matches: keep inline fallback
  const { ref, stored } = selected;

  const out: MelodyRefCarrier = { ...carrier };
  if (stored.kind === "short_responsory") {
    out.melody = toShortResponsoryMelody(stored, ref);
  } else {
    out.melody = toInlineMelody(stored, ref, day);
    if (stored.parts?.psalmTone) out.psalmTone = stored.parts.psalmTone;
  }

  // A CONDITIONED variant may carry its own sung text (e.g. the Eastertide
  // psalter antiphons replace the ferial text, not just the melody). The
  // GABC lyrics are authoritative for what is sung with that melody, so
  // hydration overrides the display text when a non-default variant wins.
  // Unconditioned defaults leave the slot text alone (hand-corrections win).
  if (ref.condition && stored.text && !Array.isArray(carrier.stanzas)) {
    if (typeof carrier.text === "string") out.text = stored.text;
    if (typeof carrier.versicle === "string" && stored.parts?.versicle) {
      out.versicle = gabcToText(stored.parts.versicle);
    }
  }
  return out;
}

/**
 * Deep-walk a resolved slot value and hydrate every object carrying
 * `melodyRefs`. Returns a copy; repository-cached objects are not mutated.
 */
export function hydrateMelodies<T>(
  value: T,
  repo: DataRepository,
  day: LiturgicalDay,
): T {
  if (Array.isArray(value)) {
    return value.map((v) => hydrateMelodies(v, repo, day)) as unknown as T;
  }
  if (value === null || typeof value !== "object" || value instanceof Date) {
    return value;
  }
  const walked = Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([k, v]) => [
      k,
      // melodyRefs / melody subtrees are payload, not slots — copy as-is.
      k === "melodyRefs" || k === "melody" ? v : hydrateMelodies(v, repo, day),
    ]),
  ) as Record<string, unknown>;
  if (Array.isArray((walked as MelodyRefCarrier).melodyRefs)) {
    return hydrateCarrier(walked as MelodyRefCarrier, repo, day) as T;
  }
  return walked as T;
}
