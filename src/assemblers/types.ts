/**
 * Assembler interface — Layer 3.
 *
 * An Assembler takes an AbstractHour (or AbstractDay) and a DataRepository,
 * resolves every SlotSource reference into actual text, and produces output
 * in its target format.
 */

import type { DataRepository } from "../data/repository.js";
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
 */
export function resolveSource(source: SlotSource, repo: DataRepository): unknown {
  if (source.kind === "fallback_chain") {
    for (const s of (source as FallbackChain).sources) {
      const val = repo.resolve(s as SlotSourceDirect);
      if (val !== undefined && val !== null) return val;
    }
    return undefined;
  }
  return repo.resolve(source as SlotSourceDirect);
}

// Typed convenience resolvers:
export function resolveHymn(src: SlotSource, repo: DataRepository): Hymn | undefined {
  return resolveSource(src, repo) as Hymn | undefined;
}
export function resolvePsalmAssignment(src: SlotSource, repo: DataRepository): PsalmAssignment | undefined {
  return resolveSource(src, repo) as PsalmAssignment | undefined;
}
export function resolveShortReading(src: SlotSource, repo: DataRepository): ShortReading | undefined {
  return resolveSource(src, repo) as ShortReading | undefined;
}
export function resolveShortResponsory(src: SlotSource, repo: DataRepository): ShortResponsory | undefined {
  return resolveSource(src, repo) as ShortResponsory | undefined;
}
export function resolveVersicle(src: SlotSource, repo: DataRepository): Versicle | undefined {
  return resolveSource(src, repo) as Versicle | undefined;
}
export function resolveAntiphon(src: SlotSource, repo: DataRepository): Antiphon | undefined {
  return resolveSource(src, repo) as Antiphon | undefined;
}
export function resolveIntercessions(src: SlotSource, repo: DataRepository): Intercessions | undefined {
  return resolveSource(src, repo) as Intercessions | undefined;
}
export function resolveConcludingPrayer(src: SlotSource, repo: DataRepository): ConcludingPrayer | undefined {
  return resolveSource(src, repo) as ConcludingPrayer | undefined;
}
export function resolveBiblicalReading(src: SlotSource, repo: DataRepository): BiblicalReading | undefined {
  return resolveSource(src, repo) as BiblicalReading | undefined;
}
export function resolvePatristicReading(src: SlotSource, repo: DataRepository): PatristicReading | undefined {
  return resolveSource(src, repo) as PatristicReading | undefined;
}
export function resolveHagiographicalReading(src: SlotSource, repo: DataRepository): HagiographicalReading | undefined {
  return resolveSource(src, repo) as HagiographicalReading | undefined;
}
