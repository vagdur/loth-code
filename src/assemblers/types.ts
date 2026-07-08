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

export { DataRepository };

// ---------------------------------------------------------------------------
// Assembler interface
// ---------------------------------------------------------------------------

export interface Assembler<TOutput> {
  assembleDay(day: AbstractDay, repo: DataRepository): TOutput;
  assembleLauds(hour: AbstractLauds, repo: DataRepository): TOutput;
  assembleOfficeOfReadings(hour: AbstractOfficeOfReadings, repo: DataRepository): TOutput;
  assembleDaytimePrayer(hour: AbstractDaytimePrayer, repo: DataRepository): TOutput;
  assembleVespers(hour: AbstractVespers, repo: DataRepository): TOutput;
  assembleCompline(hour: AbstractCompline, repo: DataRepository): TOutput;
}

// ---------------------------------------------------------------------------
// SlotSource resolution utilities (shared by all assemblers)
// ---------------------------------------------------------------------------

/**
 * Resolve a SlotSource to a value using the repository.
 * Walks a FallbackChain until the first non-undefined result.
 *
 * When a LiturgicalDay is supplied, melody references on the resolved value
 * are hydrated into inline `melody`/`psalmTone` fields (a copy is returned;
 * repository-cached data is never mutated).
 */
export function resolveSource(
  source: SlotSource,
  repo: DataRepository,
  day?: LiturgicalDay,
): unknown {
  let value: unknown;
  if (source.kind === "fallback_chain") {
    for (const s of (source as FallbackChain).sources) {
      const val = repo.resolve(s as SlotSourceDirect);
      if (val !== undefined && val !== null) {
        value = val;
        break;
      }
    }
  } else {
    value = repo.resolve(source as SlotSourceDirect);
  }
  if (value !== undefined && day) return hydrateMelodies(value, repo, day);
  return value;
}

// Typed convenience resolvers:
export function resolveHymn(src: SlotSource, repo: DataRepository, day?: LiturgicalDay): Hymn | undefined {
  return resolveSource(src, repo, day) as Hymn | undefined;
}
export function resolvePsalmAssignment(src: SlotSource, repo: DataRepository, day?: LiturgicalDay): PsalmAssignment | undefined {
  return resolveSource(src, repo, day) as PsalmAssignment | undefined;
}
export function resolveShortReading(src: SlotSource, repo: DataRepository, day?: LiturgicalDay): ShortReading | undefined {
  return resolveSource(src, repo, day) as ShortReading | undefined;
}
export function resolveShortResponsory(src: SlotSource, repo: DataRepository, day?: LiturgicalDay): ShortResponsory | undefined {
  return resolveSource(src, repo, day) as ShortResponsory | undefined;
}
export function resolveVersicle(src: SlotSource, repo: DataRepository, day?: LiturgicalDay): Versicle | undefined {
  return resolveSource(src, repo, day) as Versicle | undefined;
}
export function resolveAntiphon(src: SlotSource, repo: DataRepository, day?: LiturgicalDay): Antiphon | undefined {
  return resolveSource(src, repo, day) as Antiphon | undefined;
}
/** Resolve a daytime proper-antiphon override to an Antiphon[] (length 1 or 3). */
export function resolveAntiphonList(src: SlotSource, repo: DataRepository, day?: LiturgicalDay): Antiphon[] | undefined {
  const value = resolveSource(src, repo, day);
  if (Array.isArray(value)) return value as Antiphon[];
  return value ? [value as Antiphon] : undefined;
}
export function resolveIntercessions(src: SlotSource, repo: DataRepository, day?: LiturgicalDay): Intercessions | undefined {
  return resolveSource(src, repo, day) as Intercessions | undefined;
}
export function resolveConcludingPrayer(src: SlotSource, repo: DataRepository, day?: LiturgicalDay): ConcludingPrayer | undefined {
  return resolveSource(src, repo, day) as ConcludingPrayer | undefined;
}
export function resolveBiblicalReading(src: SlotSource, repo: DataRepository, day?: LiturgicalDay): BiblicalReading | undefined {
  return resolveSource(src, repo, day) as BiblicalReading | undefined;
}
export function resolvePatristicReading(src: SlotSource, repo: DataRepository, day?: LiturgicalDay): PatristicReading | undefined {
  return resolveSource(src, repo, day) as PatristicReading | undefined;
}
export function resolveHagiographicalReading(src: SlotSource, repo: DataRepository, day?: LiturgicalDay): HagiographicalReading | undefined {
  return resolveSource(src, repo, day) as HagiographicalReading | undefined;
}
