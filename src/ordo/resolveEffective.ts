/**
 * Resolve which direct SlotSource won for a slot (for Ordo summaries).
 */

import type { DataRepository } from "../data/repository.js";
import { sourceChoiceId, type ResolveOptions } from "../assemblers/types.js";
import type { FallbackChain, SlotSource, SlotSourceDirect } from "../types/hours.js";

export interface EffectiveSource {
  winner: SlotSourceDirect;
  /** Ad-lib tail sources that also resolve (for option annotation). */
  alternatives?: SlotSourceDirect[];
}

function yieldingSources(
  sources: SlotSourceDirect[],
  repo: DataRepository,
): SlotSourceDirect[] {
  return sources.filter((s) => {
    const val = repo.resolve(s);
    return val !== undefined && val !== null;
  });
}

function resolveEffectiveChain(
  chain: FallbackChain,
  repo: DataRepository,
  opts?: ResolveOptions,
): EffectiveSource | undefined {
  const { sources, adLibFrom } = chain;
  const chosen =
    adLibFrom !== undefined && opts?.optionPath
      ? opts.choices?.[`${opts.optionPath}.source`]
      : undefined;

  if (chosen !== undefined && adLibFrom !== undefined) {
    for (const s of sources.slice(0, adLibFrom)) {
      const val = repo.resolve(s);
      if (val !== undefined && val !== null) {
        const tail = yieldingSources(sources.slice(adLibFrom), repo);
        return {
          winner: s,
          ...(tail.length >= 2 ? { alternatives: tail } : {}),
        };
      }
    }
    const target = sources
      .slice(adLibFrom)
      .find((s) => sourceChoiceId(s) === chosen);
    if (target) {
      const val = repo.resolve(target);
      if (val !== undefined && val !== null) {
        const tail = yieldingSources(sources.slice(adLibFrom), repo);
        return {
          winner: target,
          ...(tail.length >= 2 ? { alternatives: tail } : {}),
        };
      }
    }
    for (const s of sources.slice(adLibFrom)) {
      const val = repo.resolve(s);
      if (val !== undefined && val !== null) {
        const tail = yieldingSources(sources.slice(adLibFrom), repo);
        return {
          winner: s,
          ...(tail.length >= 2 ? { alternatives: tail } : {}),
        };
      }
    }
    return undefined;
  }

  for (const s of sources) {
    const val = repo.resolve(s);
    if (val !== undefined && val !== null) {
      const tail =
        adLibFrom !== undefined
          ? yieldingSources(sources.slice(adLibFrom), repo)
          : undefined;
      return {
        winner: s,
        ...(tail && tail.length >= 2 ? { alternatives: tail } : {}),
      };
    }
  }
  return undefined;
}

/** Resolve which direct source supplies a slot's text. */
export function resolveEffectiveSource(
  source: SlotSource,
  repo: DataRepository,
  opts?: ResolveOptions,
): EffectiveSource | undefined {
  if (source.kind === "fallback_chain") {
    return resolveEffectiveChain(source as FallbackChain, repo, opts);
  }
  const direct = source as SlotSourceDirect;
  const val = repo.resolve(direct);
  if (val === undefined || val === null) return undefined;
  return { winner: direct };
}
