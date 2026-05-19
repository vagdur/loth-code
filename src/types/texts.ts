/**
 * Atomic text types — the leaves of every data tree.
 * All fields are the actual liturgical content; no liturgical logic lives here.
 */

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
}

export interface Antiphon {
  text: string;
  /** Set true when the antiphon's meaning conflicts with Alleluia
   *  so the Eastertide Alleluia should NOT be appended. */
  suppressAlleluia?: true;
  melody?: Melody;
  /** GABC notation for the psalm tone used with this antiphon's psalm/canticle. */
  psalmTone?: string;
}

export interface PsalmAssignment {
  psalmOrCanticleId: string;
  antiphon: Antiphon;
}

export interface Hymn {
  stanzas: string[];
  doxology: string;
  melody?: Melody;
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
  melody?: Melody;
}

/** Versicle between psalmody and readings (OoR) or after reading (Daytime). */
export interface Versicle {
  verse: string;
  response: string;
  melody?: Melody;
}

export interface LongResponsory {
  text: string;       // full text, with the repeated section included
  verse: string;
  repeatCue: string;  // the word/phrase at which the repeat begins
  melody?: Melody;
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
// Fixed texts (singleton collection — data/fixed_texts.yaml)
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

export interface FixedTexts {
  introductoryVerse: IntroductoryVerse;
  invitatoryVerse: InvitatoryVerse;
  alleluia: string;
  benedictus: GospelCanticleFixed;
  magnificat: GospelCanticleFixed;
  nuncDimittis: GospelCanticleFixed;
  teDeum: TeDeumFixed;
  lordsPrayer: string;
  complineResponsory: string;
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
}

export type GospelCanticleKind = "benedictus" | "magnificat" | "nuncDimittis";
