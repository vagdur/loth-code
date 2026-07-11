/**
 * Atomic text types — the leaves of every data tree.
 * All fields are the actual liturgical content; no liturgical logic lives here.
 */

import type { MelodyRef } from "./melody.js";

export interface Verse {
  number: number;
  text: string;
}

/**
 * Optional musical setting for a chanted or sung text. Present on the
 * subset of texts for which melodies are recorded; absent otherwise.
 *
 * `gabc` is the canonical storage format — Gregorio plain-text notation,
 * the de facto standard for Gregorian chant. `mode` is held alongside
 * the notation so consumers that need it (psalm-tone selection, etc.)
 * don't have to parse the GABC source.
 */
export interface Melody {
  /** Gregorian mode 1–8, when applicable. */
  mode?: number;
  /** GABC notation source. */
  gabc?: string;
  /** Free-form note (edition, "simple tone", "solemn tone", etc.). */
  note?: string;
}

/**
 * Multi-part melody for the short responsory (R / R-second-half / V / Gloria).
 * Each field is a GABC body. Any part may be absent when not notated.
 */
export interface ShortResponsoryMelody {
  mode?: number;
  note?: string;
  responsory?: string;
  responsorySecond?: string;
  versicle?: string;
  gloria?: string;
}

export interface Psalm {
  id: string;           // e.g. "psalm_94", "psalm_118_i"
  number: number;       // 1–150
  title: string;
  christianHeading: string;
  verses: Verse[];
  omittedVerses: number[];   // verse numbers excised from office use
  omittedEntirely?: true;    // Ps 57, 82, 108
}

export interface Canticle {
  id: string;           // e.g. "ot_is12", "nt_eph1", "gospel_benedictus"
  type: "OT" | "NT" | "Gospel";
  source: string;       // e.g. "Is 12:1-6"
  title: string;
  verses: Verse[];
  melody?: Melody;
  melodyRefs?: MelodyRef[];
}

export interface Antiphon {
  text: string;
  /** Set true when the antiphon's meaning conflicts with Alleluia
   *  so the Eastertide Alleluia should NOT be appended. */
  suppressAlleluia?: true;
  melody?: Melody;
  /** GABC notation for the psalm tone used with this antiphon's psalm/canticle. */
  psalmTone?: string;
  melodyRefs?: MelodyRef[];
}

export interface PsalmAssignment {
  psalmOrCanticleId: string;
  antiphon: Antiphon;
}

export interface Hymn {
  stanzas: string[];
  doxology: string;
  melody?: Melody;
  melodyRefs?: MelodyRef[];
}

/** Two hymns used on alternate psalter weeks (Weeks I/III vs II/IV). */
export interface HymnSet {
  seriesA: Hymn;
  seriesB: Hymn;
}

/** Two hymns for the Office of Readings, distinguished by time of recitation. */
export interface OorHymnSet {
  night: Hymn;
  day: Hymn;
}

export interface ShortReading {
  reference: string;
  text: string;
}

/** Short responsory after the reading at Lauds, Vespers, Compline. */
export interface ShortResponsory {
  text: string;
  versicle: string;
  melody?: ShortResponsoryMelody;
  melodyRefs?: MelodyRef[];
}

/** Versicle between psalmody and readings (OoR) or after reading (Daytime). */
export interface Versicle {
  verse: string;
  response: string;
  melody?: Melody;
  melodyRefs?: MelodyRef[];
}

export interface LongResponsory {
  text: string;       // full text, with the repeated section included
  verse: string;
  repeatCue: string;  // the word/phrase at which the repeat begins
  melody?: Melody;
  melodyRefs?: MelodyRef[];
}

export interface BiblicalReading {
  reference: string;
  text: string;
  responsory: LongResponsory;
}

export interface PatristicReading {
  author: string;
  work: string;
  reference: string;
  /** Historical note placed before the reading; NOT read aloud (GILH 168). */
  biographicalNote: string;
  text: string;
  responsory: LongResponsory;
}

/** A patristic-style reading whose author speaks about or is the saint honoured. */
export type HagiographicalReading = PatristicReading;

export interface Intention {
  firstPart: string;
  secondPart: string;
}

export interface Intercessions {
  introduction: string;
  /** Congregational refrain repeated after each intention. */
  response: string;
  intentions: Intention[];
}

export interface ConcludingPrayer {
  text: string;
}

// ---------------------------------------------------------------------------
// Fixed texts (singleton collection — data/{locale}/fixed_texts.yaml)
// ---------------------------------------------------------------------------

export interface IntroductoryVerse {
  opening: string;
  response: string;
  gloria: string;
}

export interface InvitatoryVerse {
  opening: string;
  response: string;
}

export interface GospelCanticleFixed {
  reference: string;
  text: string;
}

export interface TeDeumFixed {
  text: string;
  optionalFinalPart?: string;
}

export interface DismissalFixed {
  verse: string;
  response: string;
}

/** Swedish Ordo PDF/summary presentation strings. */
export interface OrdoLabels {
  hours: {
    invitatory: string;
    officeOfReadings: string;
    lauds: string;
    daytime: string;
    vespers: string;
    firstVespers: string;
    compline: string;
  };
  ranks: Partial<Record<
    | "triduum" | "sunday" | "solemnity" | "feastOfLordOnSunday" | "feast"
    | "obligatoryMemoria" | "optionalMemoria" | "privilegedFerial" | "ordinaryFerial",
    string
  >>;
  sources: {
    /** Short phrase after "från", e.g. "propriet". */
    propriet: string;
    seasonalPropriet: string;
    communePrefix: string;
    feria: string;
    psalterPrefix: string;
    sundayWeekI: string;
    complementaryPsalmody: string;
    fixed: string;
  };
  parts: {
    hymn: string;
    antiphons: string;
    psalms: string;
    shortReading: string;
    responsory: string;
    benedictusAntiphon: string;
    magnificatAntiphon: string;
    nuncDimittisAntiphon: string;
    intercessions: string;
    concludingPrayer: string;
    prayerForDay: string;
    firstReading: string;
    secondReading: string;
    versicle: string;
    teDeum: string;
    marianAntiphon: string;
    memoriaAddendum: string;
    invitatoryAntiphon: string;
    invitatoryPsalm: string;
  };
  prose: {
    from: string;
    and: string;
    alternatives: string;
    teDeumSaid: string;
    firstVespersForSunday: string;
    allFromSunday: string;
    allFromFeria: string;
    allFromPropriet: string;
    allFromCommune: string;
    allFromPsalter: string;
    dayCommune?: string;
    except: string;
    ifMemoriaCelebrated: string;
    memoriaAddendum: string;
    readingsFrom: string;
    restFrom: string;
    psalmodyOption: string;
    otSunday: string;
    complineForWeekday: string;
    /** e.g. "Psaltarets vecka {week}" ({week} = I–IV) */
    psalterWeek?: string;
    /** e.g. "{weekday} i {week} veckan i advent" */
    ferialInAdvent?: string;
    ferialInLent?: string;
    ferialInEaster?: string;
    ferialInOt?: string;
    ferialInEasterOctave?: string;
    ferialInHolyWeek?: string;
    /** e.g. "{day} dagen i juloktaven" (day = andra, tredje, …) */
    ferialInChristmasOctave?: string;
    ferialInChristmas?: string;
    ferialInEpiphany?: string;
    /** e.g. "{week} söndagen i Advent" */
    sundayInAdvent?: string;
    sundayInLent?: string;
    sundayInEaster?: string;
    sundayAfterChristmas?: string;
  };
  weekdays: Record<string, string>;
  /** Definite form for compline labels, e.g. "måndagen". */
  weekdaysDefinite: Record<string, string>;
  months: string[];
  seasonalNames?: Record<string, string>;
  documentTitle?: string;
}

/** Presentation strings for assemblers (headings, rubrics, prefixes). */
export interface AssemblerLabels {
  hours: {
    officeOfReadings: string;
    lauds: string;
    terce: string;
    sext: string;
    none: string;
    vespers: string;
    firstVespers: string;
    compline: string;
  };
  sections: {
    firstReading: string;
    secondReading: string;
    saintReading: string;
    teDeum: string;
    benedictus: string;
    magnificat: string;
    nuncDimittis: string;
    marianAntiphon: string;
    intercessions: string;
    ourFather: string;
  };
  rubrics: {
    letUsPray: string;
    antiphonPrefix: string;
    versicleSymbol: string;
    responseSymbol: string;
    alleluiaIntroSuffix: string;
    psalmTone?: string;
  };
  errors?: {
    textNotLoaded: string;
  };
  /** Swedish Ordo summary labels (see src/ordo/). */
  ordo?: OrdoLabels;
  /** Labels for the per-day options UI (see src/options/enumerate.ts). */
  options?: {
    celebration?: string;
    feria?: string;
    bvmSaturday?: string;
    fromPsalter?: string;
    fromSeasonal?: string;
    /** Prefixed to the common variant's own label. */
    fromCommonPrefix?: string;
    psalmody?: string;
    currentPsalmody?: string;
    complementaryPsalmody?: string;
  };
}

export interface FixedTexts {
  introductoryVerse: IntroductoryVerse;
  invitatoryVerse: InvitatoryVerse;
  alleluia: string;
  benedictus: GospelCanticleFixed;
  magnificat: GospelCanticleFixed;
  nuncDimittis: GospelCanticleFixed;
  teDeum: TeDeumFixed;
  lordsPrayer: string;
  /** "Into your hands..." — structured so it can carry melody refs and
   *  the conditioned Advent/Lent and Eastertide variants. */
  complineResponsory: ShortResponsory;
  complineBlessing: string;
  oorAcclamation: string;
  dismissalWithMinister: DismissalFixed;
  dismissalWithoutMinister: DismissalFixed;
  examinationOfConscience: string;
  marianAntiphons: {
    adventThroughFeb2: Antiphon;
    lent: Antiphon;
    eastertide: Antiphon;
    ordinaryTime: Antiphon;
  };
  labels: AssemblerLabels;
}

export type GospelCanticleKind = "benedictus" | "magnificat" | "nuncDimittis";
