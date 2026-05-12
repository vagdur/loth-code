/**
 * Atomic text types — the leaves of every data tree.
 * All fields are the actual liturgical content; no liturgical logic lives here.
 */

export interface Verse {
  number: number;
  text: string;
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
}

export interface Antiphon {
  text: string;
  /** Set true when the antiphon's meaning conflicts with Alleluia
   *  so the Eastertide Alleluia should NOT be appended. */
  suppressAlleluia?: true;
}

export interface PsalmAssignment {
  psalmOrCanticleId: string;
  antiphon: Antiphon;
}

export interface Hymn {
  stanzas: string[];
  doxology: string;
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
}

/** Versicle between psalmody and readings (OoR) or after reading (Daytime). */
export interface Versicle {
  verse: string;
  response: string;
}

export interface LongResponsory {
  text: string;       // full text, with the repeated section included
  verse: string;
  repeatCue: string;  // the word/phrase at which the repeat begins
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
