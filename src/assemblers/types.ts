/**
 * Assembler interface — Layer 3.
 *
 * An Assembler takes an AbstractHour (or AbstractDay) and a DataRepository,
 * resolves every SlotSource reference into actual text, and produces output
 * in its target format.
 */

import type { DataRepository } from "../data/repository.js";
import { hydrateMelodies } from "../data/melodyResolver.js";
import type { LiturgicalDay } from "../types/calendar.js";
import type { DayChoices } from "../types/options.js";
import type {
  AbstractCompline, AbstractDay, AbstractDaytimePrayer,
  AbstractLauds, AbstractOfficeOfReadings, AbstractVespers,
  FallbackChain, SlotSource, SlotSourceDirect,
} from "../types/hours.js";
import type {
  Antiphon, BiblicalReading, ConcludingPrayer, Hymn, HagiographicalReading,
  Intercessions, PatristicReading, PsalmAssignment, ShortReading,
  ShortResponsory, Versicle,
} from "../types/texts.js";

// Type-only on purpose: a value re-export here would put ./repository.js in
// the runtime graph of every assembler, and with it the Node loader chain.
export type { DataRepository };

// ---------------------------------------------------------------------------
// Assembler interface
// ---------------------------------------------------------------------------

export interface Assembler<TOutput> {
  assembleDay(day: AbstractDay, repo: DataRepository, choices?: DayChoices): TOutput;
  assembleLauds(hour: AbstractLauds, repo: DataRepository, choices?: DayChoices): TOutput;
  assembleOfficeOfReadings(hour: AbstractOfficeOfReadings, repo: DataRepository, choices?: DayChoices): TOutput;
  assembleDaytimePrayer(hour: AbstractDaytimePrayer, repo: DataRepository, choices?: DayChoices): TOutput;
  assembleVespers(hour: AbstractVespers, repo: DataRepository, choices?: DayChoices): TOutput;
  assembleCompline(hour: AbstractCompline, repo: DataRepository, choices?: DayChoices): TOutput;
}

// ---------------------------------------------------------------------------
// SlotSource resolution utilities (shared by all assemblers)
// ---------------------------------------------------------------------------

/**
 * Per-slot resolution options: the day's user choices plus the option-id
 * prefix identifying this slot (e.g. "lauds.hymn").  With an optionPath set,
 * `choices["<optionPath>.source"]` selects among the ad-lib tail of a marked
 * FallbackChain and `choices["<optionPath>[...].melody"]` selects among
 * alternative melody refs.  Unknown/stale choice ids are ignored.
 */
export interface ResolveOptions {
  choices?: DayChoices;
  optionPath?: string;
}

/** Stable choice id for a direct source (part_source option choices). */
export function sourceChoiceId(s: SlotSourceDirect): string {
  switch (s.kind) {
    case "saint":    return `saint:${s.id}`;
    case "common":   return `common:${s.type}:${s.variant}`;
    case "seasonal": return `seasonal:${s.key}`;
    case "psalter":  return "psalter";
    case "fixed":    return "fixed";
    case "psalm":    return `psalm:${s.id}`;
    case "canticle": return `canticle:${s.id}`;
    case "complementary": return `complementary:${s.groupId}:${s.index}`;
  }
}

function resolveChain(
  chain: FallbackChain,
  repo: DataRepository,
  opts?: ResolveOptions,
): unknown {
  const { sources, adLibFrom } = chain;
  const chosen =
    adLibFrom !== undefined && opts?.optionPath
      ? opts.choices?.[`${opts.optionPath}.source`]
      : undefined;

  if (chosen !== undefined && adLibFrom !== undefined) {
    // The strict head (proper texts) always wins when present (§5.4).
    for (const s of sources.slice(0, adLibFrom)) {
      const val = repo.resolve(s);
      if (val !== undefined && val !== null) return val;
    }
    const target = sources
      .slice(adLibFrom)
      .find((s) => sourceChoiceId(s) === chosen);
    if (target) {
      const val = repo.resolve(target);
      if (val !== undefined && val !== null) return val;
    }
    // Stale or empty choice: fall through to the default tail walk.
    for (const s of sources.slice(adLibFrom)) {
      const val = repo.resolve(s);
      if (val !== undefined && val !== null) return val;
    }
    return undefined;
  }

  for (const s of sources) {
    const val = repo.resolve(s);
    if (val !== undefined && val !== null) return val;
  }
  return undefined;
}

/**
 * Resolve a SlotSource to a value using the repository.
 * Walks a FallbackChain until the first non-undefined result, honoring an
 * ad-lib source choice on chains marked with `adLibFrom` (see ResolveOptions).
 *
 * When a LiturgicalDay is supplied, melody references on the resolved value
 * are hydrated into inline `melody`/`psalmTone` fields (a copy is returned;
 * repository-cached data is never mutated).
 */
export function resolveSource(
  source: SlotSource,
  repo: DataRepository,
  day?: LiturgicalDay,
  opts?: ResolveOptions,
): unknown {
  const value =
    source.kind === "fallback_chain"
      ? resolveChain(source as FallbackChain, repo, opts)
      : repo.resolve(source as SlotSourceDirect);
  if (value !== undefined && day) {
    return hydrateMelodies(value, repo, day, {
      ...(opts?.choices ? { choices: opts.choices } : {}),
      ...(opts?.optionPath ? { path: opts.optionPath } : {}),
    });
  }
  return value;
}

// Typed convenience resolvers:
export function resolveHymn(src: SlotSource, repo: DataRepository, day?: LiturgicalDay, opts?: ResolveOptions): Hymn | undefined {
  return resolveSource(src, repo, day, opts) as Hymn | undefined;
}
export function resolvePsalmAssignment(src: SlotSource, repo: DataRepository, day?: LiturgicalDay, opts?: ResolveOptions): PsalmAssignment | undefined {
  return resolveSource(src, repo, day, opts) as PsalmAssignment | undefined;
}
export function resolveShortReading(src: SlotSource, repo: DataRepository, day?: LiturgicalDay, opts?: ResolveOptions): ShortReading | undefined {
  return resolveSource(src, repo, day, opts) as ShortReading | undefined;
}
export function resolveShortResponsory(src: SlotSource, repo: DataRepository, day?: LiturgicalDay, opts?: ResolveOptions): ShortResponsory | undefined {
  return resolveSource(src, repo, day, opts) as ShortResponsory | undefined;
}
export function resolveVersicle(src: SlotSource, repo: DataRepository, day?: LiturgicalDay, opts?: ResolveOptions): Versicle | undefined {
  return resolveSource(src, repo, day, opts) as Versicle | undefined;
}
export function resolveAntiphon(src: SlotSource, repo: DataRepository, day?: LiturgicalDay, opts?: ResolveOptions): Antiphon | undefined {
  return resolveSource(src, repo, day, opts) as Antiphon | undefined;
}
/** Resolve a daytime proper-antiphon override to an Antiphon[] (length 1 or 3). */
export function resolveAntiphonList(src: SlotSource, repo: DataRepository, day?: LiturgicalDay, opts?: ResolveOptions): Antiphon[] | undefined {
  const value = resolveSource(src, repo, day, opts);
  if (Array.isArray(value)) return value as Antiphon[];
  return value ? [value as Antiphon] : undefined;
}
export function resolveIntercessions(src: SlotSource, repo: DataRepository, day?: LiturgicalDay, opts?: ResolveOptions): Intercessions | undefined {
  return resolveSource(src, repo, day, opts) as Intercessions | undefined;
}
export function resolveConcludingPrayer(src: SlotSource, repo: DataRepository, day?: LiturgicalDay, opts?: ResolveOptions): ConcludingPrayer | undefined {
  return resolveSource(src, repo, day, opts) as ConcludingPrayer | undefined;
}
export function resolveBiblicalReading(src: SlotSource, repo: DataRepository, day?: LiturgicalDay, opts?: ResolveOptions): BiblicalReading | undefined {
  return resolveSource(src, repo, day, opts) as BiblicalReading | undefined;
}
export function resolvePatristicReading(src: SlotSource, repo: DataRepository, day?: LiturgicalDay, opts?: ResolveOptions): PatristicReading | undefined {
  return resolveSource(src, repo, day, opts) as PatristicReading | undefined;
}
export function resolveHagiographicalReading(src: SlotSource, repo: DataRepository, day?: LiturgicalDay, opts?: ResolveOptions): HagiographicalReading | undefined {
  return resolveSource(src, repo, day, opts) as HagiographicalReading | undefined;
}
