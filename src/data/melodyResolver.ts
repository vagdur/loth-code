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
import type { DayChoices, DayOption, OptionChoice } from "../types/options.js";
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
  if (cond.weekdays && !cond.weekdays.includes(day.psalterDay)) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Ref selection
// ---------------------------------------------------------------------------

/**
 * First ref whose condition matches and whose id resolves in the store.
 *
 * With `chosenRefId` (a melody-option choice), the matching alternative is
 * preferred instead: plain `"<refId>"` picks the first matching ref with
 * that id, `"<index>:<refId>"` disambiguates duplicates by list position.
 * A stale/non-matching chosen id falls back to the default first match.
 */
export function selectMelodyRef(
  refs: MelodyRef[] | undefined,
  repo: DataRepository,
  day: LiturgicalDay,
  chosenRefId?: string,
): { ref: MelodyRef; stored: StoredMelody } | undefined {
  if (chosenRefId !== undefined) {
    const m = /^(\d+):(.*)$/.exec(chosenRefId);
    const wantedIndex = m ? Number(m[1]) : undefined;
    const wantedRef = m ? m[2] : chosenRefId;
    for (const [i, ref] of (refs ?? []).entries()) {
      if (ref.ref !== wantedRef) continue;
      if (wantedIndex !== undefined && i !== wantedIndex) continue;
      if (!matchesCondition(ref.condition, day)) continue;
      const stored = repo.getMelody(ref.ref);
      if (stored) return { ref, stored };
    }
  }
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
  chosenRefId?: string,
): MelodyRefCarrier {
  const selected = selectMelodyRef(carrier.melodyRefs, repo, day, chosenRefId);
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

/** Options steering the deep walk (see hydrateMelodies / collectMelodyOptions). */
export interface MelodyWalkOptions {
  /** Day choices; `choices["<path>.melody"]` picks the melody for a carrier. */
  choices?: DayChoices;
  /** Option-path prefix of the walked value, e.g. "lauds.hymn". */
  path?: string;
}

/**
 * Shared deep walk over a resolved slot value.  Visits every object carrying
 * `melodyRefs`, threading an option path (object keys as `.key`, array
 * elements as `[i]`).  `visit` returns the (possibly hydrated) replacement
 * carrier.  Both hydration and option collection use this single walk so the
 * option ids they see can never diverge.
 */
function walkCarriers<T>(
  value: T,
  path: string,
  visit: (carrier: MelodyRefCarrier, path: string) => MelodyRefCarrier,
): T {
  if (Array.isArray(value)) {
    return value.map((v, i) =>
      walkCarriers(v, `${path}[${i}]`, visit),
    ) as unknown as T;
  }
  if (value === null || typeof value !== "object" || value instanceof Date) {
    return value;
  }
  const walked = Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([k, v]) => [
      k,
      // melodyRefs / melody subtrees are payload, not slots — copy as-is.
      k === "melodyRefs" || k === "melody"
        ? v
        : walkCarriers(v, path ? `${path}.${k}` : k, visit),
    ]),
  ) as Record<string, unknown>;
  if (Array.isArray((walked as MelodyRefCarrier).melodyRefs)) {
    return visit(walked as MelodyRefCarrier, path) as T;
  }
  return walked as T;
}

/**
 * Deep-walk a resolved slot value and hydrate every object carrying
 * `melodyRefs`. Returns a copy; repository-cached objects are not mutated.
 * With `opts`, honors per-carrier melody choices keyed `"<path>.melody"`.
 */
export function hydrateMelodies<T>(
  value: T,
  repo: DataRepository,
  day: LiturgicalDay,
  opts?: MelodyWalkOptions,
): T {
  return walkCarriers(value, opts?.path ?? "", (carrier, path) =>
    hydrateCarrier(carrier, repo, day, opts?.choices?.[`${path}.melody`]),
  );
}

function melodyChoiceLabel(stored: StoredMelody, ref: MelodyRef): string {
  const base = stored.incipit ?? stored.text ?? stored.id;
  const mode = stored.mode !== undefined ? ` (ton ${stored.mode})` : "";
  const note = ref.note && ref.note !== "eller" ? ` — ${ref.note}` : "";
  return `${base}${mode}${note}`;
}

/**
 * Collect the melody options of a resolved (un-hydrated) slot value: one
 * `DayOption` per carrier whose ref list yields two or more distinct
 * condition-matching, store-resolving melodies.  Option ids are
 * `"<path>.melody"` with the same path scheme hydrateMelodies applies;
 * choice ids are the ref ids (`"<index>:<refId>"` when a ref id repeats).
 */
export function collectMelodyOptions(
  value: unknown,
  repo: DataRepository,
  day: LiturgicalDay,
  path: string,
): DayOption[] {
  const options: DayOption[] = [];
  walkCarriers(value, path, (carrier, carrierPath) => {
    const refs = carrier.melodyRefs ?? [];
    const choices: OptionChoice[] = [];
    const seenRefIds = new Map<string, number>();
    for (const [i, ref] of refs.entries()) {
      if (!matchesCondition(ref.condition, day)) continue;
      const stored = repo.getMelody(ref.ref);
      if (!stored) continue;
      const count = seenRefIds.get(ref.ref) ?? 0;
      seenRefIds.set(ref.ref, count + 1);
      choices.push({
        id: count === 0 ? ref.ref : `${i}:${ref.ref}`,
        label: melodyChoiceLabel(stored, ref),
      });
    }
    if (choices.length >= 2) {
      options.push({
        id: `${carrierPath}.melody`,
        kind: "melody",
        label: carrierPath,
        choices,
        defaultChoiceId: choices[0]!.id,
      });
    }
    return carrier;
  });
  return options;
}
