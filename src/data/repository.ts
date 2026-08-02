/**
 * DataRepository — holds all data and exposes typed accessors.
 *
 * Assemblers call repository methods to resolve SlotSource references into
 * actual text objects.  The repository is built once at startup.
 *
 * This module is deliberately free of Node APIs so it can run on a Cloudflare
 * Worker: reading the YAML tree lives in `./repositoryNode.js`, and the only
 * way in is `fromBundle`.  `npm run check:worker-safe` fails the build if an
 * `fs`/`path` import ever reappears here.
 */

import type { RepoBundle } from "../types/bundle.js";
import type {
  Antiphon, AssemblerLabels, BiblicalReading, Canticle, ConcludingPrayer,
  FixedTexts, GospelCanticleFixed, GospelCanticleKind, HagiographicalReading,
  Hymn, HymnSet, Intercessions, OorHymnSet, PatristicReading, Psalm,
  PsalmAssignment, ShortReading, ShortResponsory, TeDeumFixed, Versicle,
} from "../types/texts.js";
import type { PsalterDay, PsalterWeek, ComplementaryPsalmGroup, Weekday } from "../types/psalter.js";
import type { Common, CommonType, SeasonalProperDay, SaintEntry } from "../types/proper.js";
import type { SlotSourceDirect } from "../types/hours.js";
import type { StoredMelody } from "../types/melody.js";

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export class DataRepository {
  private psalms:       Map<string, Psalm>              = new Map();
  private canticles:    Map<string, Canticle>           = new Map();
  private psalterDays:  Map<string, PsalterDay>         = new Map();
  private compGroups:   ComplementaryPsalmGroup[]       = [];
  private seasonal:     Map<string, SeasonalProperDay>  = new Map();
  private saints:       Map<string, SaintEntry>         = new Map();
  private commons:      Map<CommonType, Common>         = new Map();
  private fixedTexts:   FixedTexts | null               = null;
  private melodies:     Map<string, StoredMelody>       = new Map();
  private melodyAliases: Map<string, string>            = new Map();
  readonly locale: string;

  private constructor(locale: string) {
    this.locale = locale;
  }

  // -------------------------------------------------------------------------
  // Bundles
  //
  // The only way to construct a repository.  `loadRepository` in
  // ./repositoryNode.js reads the YAML tree and comes through here too, so
  // there is exactly one assembly path and the Node and Worker hosts cannot
  // drift apart.
  // -------------------------------------------------------------------------

  static fromBundle(b: RepoBundle): DataRepository {
    const repo = new DataRepository(b.locale);
    repo.psalms        = new Map(b.psalms);
    repo.canticles     = new Map(b.canticles);
    repo.psalterDays   = new Map(b.psalterDays);
    repo.compGroups    = b.compGroups;
    repo.seasonal      = new Map(b.seasonal);
    repo.saints        = new Map(b.saints);
    repo.commons       = new Map(b.commons);
    repo.fixedTexts    = b.fixedTexts;
    repo.melodies      = new Map(b.melodies);
    repo.melodyAliases = new Map(b.melodyAliases);
    return repo;
  }

  /**
   * The inverse of `fromBundle`, for the publish step.  Kept adjacent to it on
   * purpose: the pair is the serialization contract, and splitting them across
   * modules is how such a pair starts to drift.
   */
  toBundle(): RepoBundle {
    return {
      v: 1,
      locale:        this.locale,
      psalms:        [...this.psalms],
      canticles:     [...this.canticles],
      psalterDays:   [...this.psalterDays],
      compGroups:    this.compGroups,
      seasonal:      [...this.seasonal],
      saints:        [...this.saints],
      commons:       [...this.commons],
      fixedTexts:    this.fixedTexts,
      melodies:      [...this.melodies],
      melodyAliases: [...this.melodyAliases],
    };
  }

  // -------------------------------------------------------------------------
  // Resolution entry point
  // -------------------------------------------------------------------------

  /**
   * Resolve a direct SlotSource to a value.  Returns undefined if the
   * referenced field is absent (the caller should try the next source in
   * a FallbackChain).
   */
  resolve(source: SlotSourceDirect): unknown {
    switch (source.kind) {
      case "psalm":    return this.psalms.get(source.id);
      case "canticle": return this.canticles.get(source.id);
      case "fixed":    return this.fixedTexts ? getPath(this.fixedTexts, source.field) : undefined;
      case "psalter": {
        const day = this.psalterDays.get(psalterKey(source.week, source.day));
        return day ? getPath(day, source.field) : undefined;
      }
      case "seasonal": {
        const day = this.seasonal.get(source.key);
        return day ? getPath(day, source.field) : undefined;
      }
      case "saint": {
        const saint = this.saints.get(source.id);
        return saint ? getPath(saint, source.field) : undefined;
      }
      case "common": {
        const common = this.commons.get(source.type);
        const variant = common?.variants[source.variant];
        return variant ? getPath(variant, source.field) : undefined;
      }
      case "complementary": {
        const group = this.getComplementaryGroup(source.groupId);
        return group?.psalmAssignments[source.index];
      }
    }
  }

  // -------------------------------------------------------------------------
  // Typed accessors (used by assemblers)
  // -------------------------------------------------------------------------

  getPsalm(id: string): Psalm | undefined           { return this.psalms.get(id); }
  getCanticle(id: string): Canticle | undefined     { return this.canticles.get(id); }
  getComplementaryGroups(): ComplementaryPsalmGroup[] { return this.compGroups; }
  getComplementaryGroup(id: string): ComplementaryPsalmGroup | undefined {
    return this.compGroups.find((g) => g.id === id);
  }

  getFixedTexts(): FixedTexts | undefined {
    return this.fixedTexts ?? undefined;
  }

  /** Look up a stored melody by id, following duplicate aliases. */
  getMelody(id: string): StoredMelody | undefined {
    return this.melodies.get(id) ?? this.melodies.get(this.melodyAliases.get(id) ?? "");
  }

  getAllMelodies(): StoredMelody[] {
    return [...this.melodies.values()];
  }

  /** True when `id` resolves only via a duplicate alias (should be canonicalized). */
  isMelodyAlias(id: string): boolean {
    return !this.melodies.has(id) && this.melodyAliases.has(id);
  }

  getAssemblerLabels(): AssemblerLabels {
    const labels = this.fixedTexts?.labels;
    if (!labels) {
      throw new Error(
        `Assembler labels missing for locale "${this.locale}" (fixed_texts.yaml)`,
      );
    }
    return labels;
  }

  getGospelCanticle(kind: GospelCanticleKind): GospelCanticleFixed | undefined {
    const fixed = this.fixedTexts;
    if (!fixed) return undefined;
    return fixed[kind];
  }

  getTeDeum(): TeDeumFixed | undefined {
    return this.fixedTexts?.teDeum;
  }

  resolveHymn(source: SlotSourceDirect): Hymn | undefined {
    return this.resolve(source) as Hymn | undefined;
  }
  resolveAntiphon(source: SlotSourceDirect): Antiphon | undefined {
    return this.resolve(source) as Antiphon | undefined;
  }
  resolvePsalmAssignment(source: SlotSourceDirect): PsalmAssignment | undefined {
    return this.resolve(source) as PsalmAssignment | undefined;
  }
  resolveShortReading(source: SlotSourceDirect): ShortReading | undefined {
    return this.resolve(source) as ShortReading | undefined;
  }
  resolveShortResponsory(source: SlotSourceDirect): ShortResponsory | undefined {
    return this.resolve(source) as ShortResponsory | undefined;
  }
  resolveVersicle(source: SlotSourceDirect): Versicle | undefined {
    return this.resolve(source) as Versicle | undefined;
  }
  resolveBiblicalReading(source: SlotSourceDirect): BiblicalReading | undefined {
    return this.resolve(source) as BiblicalReading | undefined;
  }
  resolvePatristicReading(source: SlotSourceDirect): PatristicReading | undefined {
    return this.resolve(source) as PatristicReading | undefined;
  }
  resolveHagiographicalReading(source: SlotSourceDirect): HagiographicalReading | undefined {
    return this.resolve(source) as HagiographicalReading | undefined;
  }
  resolveIntercessions(source: SlotSourceDirect): Intercessions | undefined {
    return this.resolve(source) as Intercessions | undefined;
  }
  resolveConcludingPrayer(source: SlotSourceDirect): ConcludingPrayer | undefined {
    return this.resolve(source) as ConcludingPrayer | undefined;
  }
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/** Map key for a psalter day.  Exported so the Node loader keys entries the same way. */
export function psalterKey(week: PsalterWeek, day: Weekday): string {
  return `week${week}_${day.toLowerCase()}`;
}

/**
 * Navigate a dot-path through an object, handling array indices.
 *
 * Supports paths like "lauds.psalmAssignments[0].antiphon.text".
 * Each dot-separated segment may optionally carry a trailing "[N]" index.
 */
function getPath(obj: unknown, dotPath: string): unknown {
  // Split on dots first, then parse each segment for an optional [N] suffix.
  const parts = dotPath.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined;
    }
    const arrayMatch = /^([^\[]+)\[(\d+)\]$/.exec(part);
    if (arrayMatch) {
      const key = arrayMatch[1] as string;
      const index = parseInt(arrayMatch[2] as string, 10);
      const arr = (current as Record<string, unknown>)[key];
      if (!Array.isArray(arr)) return undefined;
      current = arr[index];
    } else {
      current = (current as Record<string, unknown>)[part];
    }
  }
  return current;
}
