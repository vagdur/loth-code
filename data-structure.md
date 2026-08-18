# Data Structure for Programmatic Assembly of the Liturgy of the Hours

This document specifies the collections of data and their schemas required to assemble the Office for any given day. Type notation is pseudo-TypeScript; all fields are required unless marked `?` (optional / may be absent). References in parentheses are to `office-spec.md` sections.

---

## Overview

Assembly proceeds in three stages:

1. **Calendar resolution** — given a date and a calendar identifier, determine the `LiturgicalDay`.
2. **Text resolution** — for each variable slot in each Hour, walk the fallback chain (proper → common → psalter).
3. **Hour assembly** — arrange resolved texts in the structural order defined per Hour.

The data falls into five categories:

| Category | Collections |
|---|---|
| **Text primitives** | `psalms`, `canticles`, `fixed_texts` |
| **Ferial defaults** | `psalter`, `complementary_psalmody` |
| **Seasonal overrides** | `proper_of_seasons` |
| **Sanctoral schedule** | `calendars` (universal + particular overlays; §6.1) |
| **Sanctoral overrides** | `proper_of_saints`, `commons` |
| **Calendar logic** | `calendar` (algorithms + sanctoral registry) |

---

## 1. Text Primitives

### 1.1 `Psalm`

```
Psalm {
  id:               string          // e.g. "psalm_94", "psalm_118_I"
  number:           int             // 1–150
  title:            string
  christian_heading: string         // interpretive heading added for the Office
  verses:           Verse[]
  omitted_verses:   int[]           // verse numbers excised from Office use (§10)
}

Verse {
  number: int
  text:   string
}
```

Three psalms are omitted from the Office entirely (Ps 57, 82, 108); they appear in this collection but are flagged via a convention (e.g., `omitted_entirely: true`). Ps 118 is split into 22 sections; each section is a separate `Psalm` entry with ids like `psalm_118_I` through `psalm_118_XXII`. Ps 77, 104, and 105 are reserved for privileged seasons and must not appear in ordinary-time psalmody slots.

### 1.2 `Canticle`

```
Canticle {
  id:        string   // e.g. "ot_is12", "nt_eph1", "gospel_benedictus"
  type:      "OT" | "NT" | "Gospel"
  source:    string   // e.g. "Is 12:1-6", "Eph 1:3-10", "Lk 1:68-79"
  title:     string
  verses:    Verse[]
  melody?:   Melody   // optional; mostly used for Gospel canticles with proper tones
  melody_refs?: MelodyRef[]
}
```

**OT canticles** — one per ferial day per psalter week (4 weeks × 6 weekdays = 24 ferial canticles), plus two Sunday variants (the two parts of the Canticle of the Three Children, Dan 3:57-88 / 3:52-56).

**NT canticles** — one per day of the week (7 canticles from Epistles or Revelation); with two substitutions: Sundays of Lent use a canticle from 1 Peter instead of the Revelation canticle; Epiphany and Transfiguration use a canticle from 1 Timothy.

**Gospel canticles** — three fixed canticles: *Benedictus* (Lk 1:68-79), *Magnificat* (Lk 1:46-55), *Nunc dimittis* (Lk 2:29-32).

### 1.3 `FixedTexts`

Locale bundles live under `data/{locale}/` (e.g. `data/en/fixed_texts.yaml`). A full translation copies the entire locale tree.

```
FixedTexts {
  invitatory_verse:          string   // "Lord, open our lips..."
  introductory_verse:        string   // "O God, come to our aid..."
  gloria_patri:              string   // "Glory be to the Father..."
  alleluia:                  string

  benedictus:                Canticle // ref to canticle "gospel_benedictus"
  magnificat:                Canticle // ref to canticle "gospel_magnificat"
  nunc_dimittis:             Canticle // ref to canticle "gospel_nunc_dimittis"

  te_deum: {
    main_text:               string
    optional_final_part:     string   // from "Lord, save your people..." onward
  }

  lords_prayer:              string

  compline_responsory:       ShortResponsory   // "Into your hands..."; melody_refs
                                               // carry the Advent/Lent and Eastertide variants
  compline_blessing:         string   // "The Lord grant us a quiet night..."

  oor_acclamation:           string   // "Let us praise the Lord: Thanks be to God"
  dismissal_with_minister:   string   // "The Lord be with you" + "Go in the peace of Christ"
  dismissal_without_minister: string  // "The Lord bless us..."

  marian_antiphons: {
    advent_through_feb2:     Antiphon // Alma Redemptoris Mater
    feb2_through_easter:     Antiphon // Ave Regina caelorum
    eastertide:              Antiphon // Regina caeli (always used in Eastertide)
    ordinary_time:           Antiphon // Salve Regina
  }

  labels: AssemblerLabels   // hour titles, section headings, rubric prefixes (i18n)
}
```

---

## 2. Shared Sub-types

These types appear throughout the larger structures below.

### 2.1 Melody store and melody references

Sung texts normally do not embed GABC. Instead they carry `melody_refs` into a
per-locale **melody store** (`data/{locale}/melodies/*.yaml`). A locale that
transcribes chant from printed sources generates that store from its own
extraction pipeline and commits it, so re-extraction produces reviewable
diffs; `data/en/melodies/sample.yaml` here is hand-written instead. Rubrics
never specify melodies, so attaching several condition-selected melodies to one
rubric-specified text is an enrichment, not an override.

```
SundayCycle = "A" | "B" | "C"    // Sunday gospel lectionary cycle

MelodyCondition {
  // All present fields must match (AND); within a field any value matches (OR).
  // Absent condition = matches every day.
  seasons?:       Season[]
  day_classes?:   DayClass[]
  sunday_cycles?: SundayCycle[]
  weekdays?:      Weekday[]   // "Sunday" … "Saturday" (psalter day name)
  date_range?:    { from: string, to: string }  // inclusive "MM-DD", may wrap year end
}

MelodyRef {
  // Ordered list on a slot; the FIRST entry whose condition matches the
  // LiturgicalDay wins (unconditioned entries always match — defaults last).
  // Later matching entries are free alternatives ("or:" in the sources).
  ref:        string           // StoredMelody.id or one of its aliases
  condition?: MelodyCondition
  note?:      string           // "eller", "solemn tone", ...
}

MelodyKind = "hymn" | "antiphon" | "gospel_antiphon" | "short_responsory"
           | "long_responsory" | "versicle" | "psalm_tone" | "canticle" | "other"

StoredMelody {
  id:           string         // stable id from the source tree, e.g. "en/sample/antiphon-1"
  kind:         MelodyKind
  mode?:        int
  language?:    "svenska" | "latin" | "english"  // exsurge syllabification
  gabc?:        string         // full GABC body (hymns etc.)
  parts?: {                    // split bodies, by kind:
    antiphon?: string,  psalm_tone?: string,                 // antiphon / gospel_antiphon
    antiphon_paschal?: string,                               // Eastertide body, when notated
    first_verse?: string,                                    // pointed first verse (gospel_antiphon)
    responsory?: string, responsory_second?: string,         // short responsory
    versicle?: string,   gloria?: string,
    // dialogue: versicle, response, gloria?, alleluia?, blessing?, amen?, ...
    // Assemblers merge dialogue / short-responsory parts into one display score.
  }
  text?:        string         // de-hyphenated text recovered from GABC lyrics
  incipit?:     string         // from raw metadata; cross-check for `text`
  content_hash: string         // hash of normalized GABC; rename/duplicate detection
  aliases?:     string[]       // ids of exact-content duplicates folded into this entry
  source?: { index, pdf, source_category, page, section_label, variant_label?, filename }
                               // provenance in the extraction tree; absent when hand-written
}
```

Resolution: `melody_refs` is authoritative when present; an inline `melody` is
the terminal unconditioned fallback (and the hydrated output shape). A text
with neither field simply has no recorded melody yet — legal, and surfaced by
the coverage report rather than the schema. Antiphon hydration also copies
`parts.psalm_tone` onto `psalm_tone` and `parts.first_verse` onto `first_verse`.

Text override: when a **conditioned** variant wins, its stored `text` (the
de-hyphenated GABC lyrics) replaces the slot's display text during hydration —
e.g. the Eastertide psalter antiphons replace the ferial text, not just the
melody. Unconditioned defaults never override the slot text, so hand
corrections to data files always win for the ordinary case.

```
Antiphon {
  text: string
  // Alleluia appended by the assembly algorithm during Eastertide (§7)
  // unless assembly_context.suppress_alleluia == true for this antiphon
  suppress_alleluia?: boolean
  melody?: Melody
  // GABC notation for the psalm tone used with this antiphon's psalm/canticle.
  // Kept as raw GABC for now; can be promoted to a structured type later.
  psalm_tone?: string
  // Pointed first verse of the gospel canticle (`gospel_antiphon` part).
  // Hydrated from the store; assemblers emit it as a score only — the lyrics
  // are the canticle's opening line, so a prose rendering would duplicate it.
  first_verse?: string
  melody_refs?: MelodyRef[]   // references into the melody store (§2.1)
}

PsalmAssignment {
  psalm_or_canticle_id: string      // references Psalm.id or Canticle.id
  antiphon:             Antiphon
}

// Sentinel `psalm_unassigned` — empty psalm with no verses. Used when proper
// psalm/canticle identity is not yet sourced (e.g. sanctis Vespers psalmody
// before *Timmarnas liturgi* text propers are populated). Antiphons and
// melodies still resolve; assemblers omit the psalm body. Replace per slot
// with the real id when full propers arrive.

HymnSet {
  // For ordinary-time Hours (excluding OoR): two hymns alternate by psalter-week parity.
  // Week I / III → series_a; Week II / IV → series_b.
  series_a: Hymn
  series_b: Hymn
}

OorHymnSet {
  // For the Office of Readings: two hymns; choice depends on time of recitation.
  night:  Hymn
  day:    Hymn
}

Hymn {
  stanzas:   string[]
  doxology:  string
  melody?:   Melody     // single melody for all stanzas (and doxology, unless noted)
  melody_refs?: MelodyRef[]
}

Melody {
  // Optional musical setting attached to sung texts (hymns, antiphons,
  // responsories, versicles, Gospel canticles, etc.). Present only for
  // those texts whose melodies are recorded; absent otherwise.
  // This is the RESOLVED/hydrated shape; authored data normally carries
  // melody_refs instead (§2.1) and hydration fills this field.
  mode?: int            // Gregorian mode 1–8, when applicable
  gabc?: string         // GABC notation source (Gregorio plain-text format)
  note?: string         // edition, "simple tone", "solemn tone", etc.
}

ShortReading {
  reference: string
  text:      string
}

ShortResponsory {
  // After the short reading at Lauds, Vespers, Compline.
  // May be omitted (§3.2 item 7).
  text:     string
  versicle: string
  melody?:  ShortResponsoryMelody
  melody_refs?: MelodyRef[]
}

ShortResponsoryMelody {
  // Logical GABC sections (not the printed layout). Assemblers reassemble
  // them for display as:
  //   ℟. first + second
  //   ℣. versicle + second
  //   ℣. Gloria Patri  ℟. first + second   (the final ℟. written out)
  mode?: int
  note?: string
  responsory?:        string   // R., first half
  responsory_second?: string   // repeated second half
  versicle?:          string   // V.
  gloria?:            string   // Gloria Patri line
}

Versicle {
  // Transition between psalmody and readings in OoR, and
  // after the short reading in Daytime Prayer.
  verse:    string
  response: string
  melody?:  Melody
  melody_refs?: MelodyRef[]
}

BiblicalReading {
  reference:  string
  text:       string
  responsory: LongResponsory
}

PatristicReading {
  author:           string
  work:             string
  reference:        string
  biographical_note: string  // not read aloud in celebration (§13)
  text:             string
  responsory:       LongResponsory
}

HagiographicalReading {
  // Same fields as PatristicReading; the author speaks about or
  // is the saint being honoured.
  author:           string
  work:             string
  reference:        string
  biographical_note: string
  text:             string
  responsory:       LongResponsory
}

LongResponsory {
  text:        string   // main responsory text (with repeat section marked)
  verse:       string
  repeat_cue:  string   // text cue from which the repetition begins
  melody?:     Melody
  melody_refs?: MelodyRef[]
}

Intercessions {
  // At Lauds: invocations consecrating the day (§3.2 item 9).
  // At Vespers: petitions; final intention is always for the dead (§3.2 item 9).
  introduction: string
  response:     string   // congregational refrain
  intentions:   Intention[]
}

Intention {
  first_part:  string
  second_part: string   // can serve as the variable response
}

ConcludingPrayer {
  text: string
}
```

---

## 3. The Psalter (Four-Week Cycle)

**Collection:** `psalter` — 28 entries, one per (week, day).

```
PsalterDay {
  week: 1 | 2 | 3 | 4
  day:  "Sunday" | "Monday" | "Tuesday" | "Wednesday"
       | "Thursday" | "Friday" | "Saturday"

  invitatory_antiphon: Antiphon   // ferial default for ordinary time

  office_of_readings: {
    hymns:            OorHymnSet
    psalm_assignments: PsalmAssignment[3]
    versicle:         Versicle
    // Readings are NOT in the psalter; they come from ProperOfSeasons
    // or ProperOfSaints (see §5.4, §12).
  }

  lauds: {
    hymns:             HymnSet
    psalm_assignments: PsalmAssignment[3]
    // Slot order: [morning psalm, OT canticle, psalm of praise] (§3.2)
    short_reading:     ShortReading
    short_responsory:  ShortResponsory
    benedictus_antiphon: Antiphon
    intercessions:     Intercessions
    concluding_prayer: ConcludingPrayer
  }

  // Current psalmody for Terce, Sext, None (§3.4).
  // Three separate entries because each Hour has its own hymn,
  // short reading, versicle, and concluding prayer.
  terce: DaytimeHourEntry
  sext:  DaytimeHourEntry
  none:  DaytimeHourEntry

  // First Vespers of the Sunday (said Saturday evening; stored on the
  // SUNDAY entry it belongs to). Present only on Sunday psalter days.
  first_vespers?: {
    hymns:             HymnSet
    psalm_assignments: PsalmAssignment[3]   // [psalm 1, psalm 2, NT canticle (Phil 2)]
    short_reading:     ShortReading
    short_responsory:  ShortResponsory
    magnificat_antiphon: Antiphon
    intercessions:     Intercessions
    concluding_prayer: ConcludingPrayer
  }

  vespers: {
    hymns:             HymnSet
    psalm_assignments: PsalmAssignment[3]
    // Slot order: [psalm 1, psalm 2, NT canticle] (§3.2)
    short_reading:     ShortReading
    short_responsory:  ShortResponsory
    magnificat_antiphon: Antiphon
    intercessions:     Intercessions
    concluding_prayer: ConcludingPrayer
  }

  compline: {
    // Sunday psalmody split by First/Second Vespers context (§3.5):
    after_first_vespers:  PsalmAssignment[]  // Ps 4 + Ps 133
    after_second_vespers: PsalmAssignment[]  // Ps 90
    // For non-Sunday days, psalms of confidence given per day:
    default_psalm_assignments: PsalmAssignment[]
    hymn:             Hymn
    short_reading:    ShortReading
    nunc_dimittis_antiphon: Antiphon
    concluding_prayer: ConcludingPrayer   // always psalter (§6)
  }
}

DaytimeHourEntry {
  hymn:             Hymn
  psalm_assignments: PsalmAssignment[3]  // current psalmody
  short_reading:    ShortReading
  versicle:         Versicle
  concluding_prayer: ConcludingPrayer
}
```

**Notes on psalter week selection:**
- Lauds OT canticle: from the canticle assigned to that week/day.
- On Sunday Week I–IV the OT canticle rotates through the two parts of the Canticle of the Three Children.
- Vespers NT canticle: fixed by day of week; substitutions for Sundays of Lent and for Epiphany/Transfiguration are handled in the assembly algorithm.

---

## 4. Complementary Psalmody

**Collection:** `complementary_psalmody` — a fixed set of groups drawn from the gradual psalms (Ps 120–134).

```
ComplementaryPsalmGroup {
  id:               string    // e.g. "gradual_group_1"
  psalm_assignments: PsalmAssignment[3]
}
```

There are enough groups to cover each of the three Daytime Hours across the week. The distribution across the week is fixed and repeated each week. The assembly algorithm selects the group matching the Hour and day when complementary psalmody is required (§3.4, §10).

When a solemnity falls on a day that is not a Sunday, the complementary psalmody is used for all three Daytime Hours, each with its proper antiphon. If the solemnity falls on a Sunday, Sunday Week I psalmody is used instead.

---

## 5. Proper of Seasons

**Collection:** `proper_of_seasons` — keyed by `SeasonalDayKey`.

The Proper of Seasons provides override texts for every day within the liturgical seasons. Each entry is **sparse**: only fields where the season overrides the psalter default need to be present. The assembly algorithm treats absent fields as "use psalter default."

**Season-scoped daytime defaults.** Some daytime-prayer propers belong to a
whole season rather than a single day: Advent and Lent give one antiphon (and
hymn) per hour for the entire season; Eastertide gives one antiphon per
weekday, shared across the three hours. These live in `proper_of_seasons`
under coarse keys `daytime_<season>` (weekday-invariant) and
`daytime_<season>_<weekday>` (weekday-specific), e.g. `daytime_advent`,
`daytime_eastertide_monday`. They are ordinary sparse `SeasonalProperDay`
entries carrying only `terce`/`sext`/`none`, and are **never** returned by the
calendar for a real date — Daytime Prayer consults them as a fallback tier
*after* the day's own key and *before* the psalter (see §9). The keys are
produced by `seasonDaytimeKeys(season, weekday)` in `src/hours/resolver.ts`.

### 5.1 `SeasonalDayKey`

A liturgical position identifier independent of calendar year:

```
SeasonalDayKey =
  // Advent
  | "advent_w1_sun" | "advent_w1_mon" | ... | "advent_w4_sat"
  | "advent_dec17" | "advent_dec18" | ... | "advent_dec24"

  // Christmas season
  | "christmas_dec25"       // Christmas Day
  | "christmas_dec26" | ... | "christmas_dec31"
  | "christmas_jan01"       // Solemnity of Mary (Octave of Christmas)
  | "christmas_jan02" | ... | "christmas_jan05"
  | "epiphany"              // Jan 6, or Sunday between Jan 2–8
  | "epiphany_mon" | ... | "epiphany_sat"  // days after Epiphany
  | "baptism_of_lord"       // Sunday after Epiphany (or Jan 13 if Epiphany on Jan 7–8)

  // Ordinary Time I (Baptism of Lord until Ash Wednesday)
  | "ot_w1_mon" | ... | "ot_w8_sat"   // as many weeks as exist before Lent

  // Lent
  | "ash_wednesday"
  | "lent_w1_thu" | "lent_w1_fri" | "lent_w1_sat"
  | "lent_w1_sun" | "lent_w2_mon" | ... | "lent_w5_sat"

  // Holy Week
  | "palm_sunday"
  | "holy_monday" | "holy_tuesday" | "holy_wednesday"

  // Easter Triduum
  | "holy_thursday"   // Mass of the Lord's Supper evening onward
  | "good_friday"
  | "holy_saturday"
  | "easter_vigil"    // for the vigil readings (used in assembly of OoR by those not present)

  // Eastertide
  | "easter_sunday"
  | "easter_mon" | ... | "easter_sat"  // Easter octave
  | "easter_w2_sun" | ... | "easter_w7_sat"
  | "ascension"           // 40th day, or Sunday of week 6 depending on locale
  | "ascension_mon" | ... | "pentecost_sat"
  | "pentecost"

  // Ordinary Time II (after Pentecost until Advent)
  | "ot_w1_sun" | ... | "ot_w34_sat"
```

**Note on ordinary time:** Ordinary-time weeks I–VIII before Lent and weeks I–XXXIV after Pentecost are the same 34-week cycle; the key scheme should make this explicit (e.g., a single `ot_wN_day` key, with the calendar algorithm determining which weeks exist in a given year before Lent and which resume after Pentecost).

### 5.2 `SeasonalProperDay`

```
SeasonalProperDay {
  key: SeasonalDayKey

  // Each sub-object is optional; absent = no override for that Hour/element.
  invitatory_antiphon?: Antiphon

  office_of_readings?: {
    hymn?:             Hymn   // propers carry ONE hymn per hour
    psalm_assignments?: PsalmAssignment[3]   // only for Triduum, octaves, solemnities
    versicle?:         Versicle
    // Biblical reading: one-year cycle AND/OR two-year cycle Year I / Year II
    biblical_reading?:     BiblicalReading          // single-year (standard Office)
    biblical_reading_yr1?: BiblicalReading          // two-year cycle Year I
    biblical_reading_yr2?: BiblicalReading          // two-year cycle Year II
    // Patristic reading: same dual-cycle structure
    patristic_reading?:     PatristicReading
    patristic_reading_yr1?: PatristicReading
    patristic_reading_yr2?: PatristicReading
  }

  first_vespers?: VespersSlot   // only on Sundays and solemnities of the season

  lauds?: {
    hymn?:              Hymn   // propers carry ONE hymn per hour
    psalm_assignments?: PsalmAssignment[3]
    short_reading?:     ShortReading
    short_responsory?:  ShortResponsory
    benedictus_antiphon?: Antiphon
    // Sunday gospel-canticle antiphon by lectionary Year A/B/C (editio typica
    // altera; office-spec §7). Assembly selects via LiturgicalDay.sunday_cycle
    // before falling back to the plain field — same pattern as
    // biblical_reading_yr1 / _yr2 above.
    benedictus_antiphon_yr_a?: Antiphon
    benedictus_antiphon_yr_b?: Antiphon
    benedictus_antiphon_yr_c?: Antiphon
    intercessions?:     Intercessions
    concluding_prayer?: ConcludingPrayer
  }

  terce?: DaytimeProperSlot
  sext?:  DaytimeProperSlot
  none?:  DaytimeProperSlot

  vespers?: VespersSlot

  // Compline has no seasonal proper texts (always from psalter),
  // except the Marian antiphon is determined by season in FixedTexts.
}

VespersSlot {
  hymn?:              Hymn   // propers carry ONE hymn per hour
  psalm_assignments?: PsalmAssignment[3]
  short_reading?:     ShortReading
  short_responsory?:  ShortResponsory
  magnificat_antiphon?: Antiphon
  // Sunday gospel-canticle antiphon by lectionary Year A/B/C (see lauds above).
  magnificat_antiphon_yr_a?: Antiphon
  magnificat_antiphon_yr_b?: Antiphon
  magnificat_antiphon_yr_c?: Antiphon
  intercessions?:     Intercessions
  concluding_prayer?: ConcludingPrayer
}

DaytimeProperSlot {
  hymn?:              Hymn
  psalm_assignments?: PsalmAssignment[3]   // present only on certain solemnities
  // Proper daytime antiphons, length 1 OR 3 (GILH 122): a single antiphon is
  // sung around all three psalms; three give one antiphon per psalm. No rule
  // picks which, so the data carries one or three and assembly renders to match.
  // Absent → each psalm keeps its own antiphon from the psalmody.
  antiphons?:         Antiphon[]           // length 1 or 3
  short_reading?:     ShortReading
  versicle?:          Versicle
  concluding_prayer?: ConcludingPrayer
}
```

---

## 6. Proper of Saints

**Collection:** `proper_of_saints` — one entry per saint with proper texts. Schedule fields (`name`, `rank`, `calendar_position`, `applicable_commons`) live in `calendars/` (§6.1); entries here share the same `id`.

```
SaintEntry {
  id:    string           // stable identifier, e.g. "immaculate_conception"

  // Proper texts — all optional; absent = fall back per fallback chain (§8).
  invitatory_antiphon?: Antiphon

  office_of_readings?: {
    hymn?:                   Hymn
    psalm_assignments?:      PsalmAssignment[3]   // solemnities / feasts only
    versicle?:               Versicle
    biblical_reading?:       BiblicalReading      // solemnities / feasts
    hagiographical_reading?: HagiographicalReading
  }

  // First Vespers: present only if rank == "solemnity" (§5.2).
  first_vespers?: VespersSlot

  lauds?: {
    hymn?:               Hymn
    // psalm_assignments almost never present for saints
    short_reading?:      ShortReading
    short_responsory?:   ShortResponsory
    benedictus_antiphon?: Antiphon
    intercessions?:      Intercessions
    concluding_prayer:   ConcludingPrayer   // always present (§5.4)
  }

  terce?: { short_reading?: ShortReading; concluding_prayer?: ConcludingPrayer }
  sext?:  { short_reading?: ShortReading; concluding_prayer?: ConcludingPrayer }
  none?:  { short_reading?: ShortReading; concluding_prayer?: ConcludingPrayer }

  vespers?: VespersSlot   // VespersSlot is defined in §5.2 above
}

CalendarPosition =
  | { type: "fixed"; month: int; day: int }
  | { type: "moveable"; key: SeasonalDayKey }
  // Transferable solemnities have their own transfer rules per calendar rubrics.
```

### 6.1 Sanctoral calendar (schedule)

**Collections:** `calendars/` — when saints are celebrated (universal + particular overlays). Liturgical **texts** remain in `proper_of_saints`; both layers share the same saint `id`.

| Path | Role |
|------|------|
| `calendars/index.yaml` | Registry of `calendar_id` → universal or particular layer |
| `calendars/general/entries.yaml` | General Roman Calendar entries |
| `calendars/local/<id>.yaml` | Particular calendar overlay (`additions`, `overrides`, `suppressions`) |

```
SanctoralCalendarEntry {
  id:                 string
  name:               string
  rank:               "solemnity" | "feast" | "obligatory_memoria" | "optional_memoria"
  calendar_position:  CalendarPosition
  applicable_commons: CommonType[]
  transfer_rule?:     string   // key into TS transfer-rule registry (solemnities only)
}

ParticularCalendarOverlay {
  calendar_id:   string
  extends:       string                    // always "general" for now
  additions?:    SanctoralCalendarEntry[]
  overrides?:    Partial<SanctoralCalendarEntry> & { id: string }[]
  suppressions?: string[]                  // saint ids omitted in this calendar
  seasonal_observance?: {                   // conference norms for seasonal solemnities
    epiphany?:        "fixed_jan_6" | "sunday_jan_2_8"
    corpus_christi?: "thursday_after_trinity" | "second_sunday_after_pentecost"
    ascension?:      "thursday" | "sunday"
  }
}
```

`AssemblyContext.calendar_id` selects the merged calendar at runtime. Sanctoral solemnity transfer algorithms (e.g. Annunciation GNLY 60) live in code, referenced by `transfer_rule` keys on saint entries. Seasonal solemnity dates (Epiphany, Corpus Christi, Ascension) use `seasonal_observance` on particular overlays; omitted keys inherit universal defaults from `DEFAULT_SEASONAL_OBSERVANCE` in code.

---

## 7. Commons

**Collection:** `commons` — one entry per `CommonType`, each containing one or more variants.

Commons provide **complete** sets of texts (no absent fields), so they are always a valid terminus for the fallback chain.

```
CommonType =
  | "dedication_of_a_church"
  | "bvm"
  | "apostles"
  | "martyrs"          // sub-types: one martyr, several martyrs, martyr-bishop, etc.
  | "pastors"          // sub-types: pope, bishop, priest, missionary
  | "doctors"
  | "virgins"
  | "holy_men_women"   // sub-types: abbot, monk, nun, lay person, etc.

Common {
  type:     CommonType
  variants: CommonVariant[]
}

CommonVariant {
  label: string   // e.g. "For one martyr" / "For several martyrs"

  invitatory_antiphon: Antiphon

  office_of_readings: {
    hymns:            OorHymnSet   // night/day is time-of-recitation, kept for commons
    psalm_assignments: PsalmAssignment[3]
    versicle:         Versicle
    biblical_reading: BiblicalReading
    hagiographical_reading: HagiographicalReading
  }

  first_vespers: VespersSlot    // for use when the Common is applied to a solemnity
  lauds: {
    hymn:                Hymn
    psalm_assignments:   PsalmAssignment[3]
    short_reading:       ShortReading
    short_responsory:    ShortResponsory
    benedictus_antiphon: Antiphon
    intercessions:       Intercessions
    concluding_prayer:   ConcludingPrayer
  }
  terce: { hymn: Hymn; psalm_assignments: PsalmAssignment[3]; short_reading: ShortReading; versicle: Versicle; concluding_prayer: ConcludingPrayer }
  sext:  { ... }
  none:  { ... }
  vespers: VespersSlot
}
```

---

## 8. Calendar Resolution

The calendar layer produces a `LiturgicalDay` from a civil date and a calendar identifier. It encapsulates all computus and ranking logic.

### 8.1 `LiturgicalCalendar` (algorithms required)

```
LiturgicalCalendar {
  // Given a date, return the fully resolved liturgical day.
  resolve(date: Date, calendar_id: string): LiturgicalDay
}
```

Algorithms needed:
- **Computus** — Julian/Gregorian calculation of Easter Sunday.
- **Season determination** — map any date to its liturgical season.
- **Psalter week** — from the season and date, compute which of Weeks I–IV is current (§10, §spec-§20 step 2). Anchor Sundays always begin Week I.
- **Ordinary-time week number** — for OoR reading selection (§12).
- **Reading year** — Year I (odd calendar year) or Year II (even); only relevant if using the two-year supplement.
- **Ranking / collision resolution** — given all observances on a date (from general and particular calendars), select the highest-ranking celebration; apply memoria-suppression rules (§5.5).
- **First Vespers identification** — determine whether the evening of a given date belongs to the First Vespers of the next day's solemnity or Sunday.

### 8.2 `LiturgicalDay`

```
LiturgicalDay {
  date:          Date
  season:        Season
  psalter_week:  1 | 2 | 3 | 4
  psalter_day:   "Sunday" | "Monday" | "Tuesday" | "Wednesday"
                | "Thursday" | "Friday" | "Saturday"
  reading_year:  "I" | "II"     // for two-year OoR cycle
  sunday_cycle:  "A" | "B" | "C" // Sunday gospel lectionary cycle (gospel-canticle antiphon texts + melody variants)
  ot_week_number: int           // 1–34, for OoR reading selection in OT

  // What is celebrated on this day:
  celebration: Celebration

  // Evening context: does the evening of THIS date belong to the
  // First Vespers of the following day's celebration?
  evening: {
    has_first_vespers:    boolean
    first_vespers_celebration?: Celebration
  }

  // Saturday BVM memoria permitted today?
  saturday_bvm_permitted: boolean
}

Season =
  | "advent"
  | "christmas"
  | "ordinary_time"
  | "lent"
  | "holy_week"
  | "easter_triduum"
  | "eastertide"

Celebration {
  type:   DayClass
  source: "seasonal" | "saint"

  // Exactly one of the following is set:
  seasonal_key?: SeasonalDayKey
  saint_id?:     string

  // Pre-computed flags used by the assembly algorithm:
  memoria_suppressed:    boolean   // §5.5 — no saint texts used
  memoria_only_optional: boolean   // §5.5 — obligatory reduced to optional
  allow_memoria_addendum: boolean  // §5.5 — optional addendum permitted in privileged season
  is_triduum:            boolean
}

DayClass =
  | "triduum"
  | "sunday"
  | "solemnity"
  | "feast_of_lord_on_sunday"
  | "feast"
  | "obligatory_memoria"
  | "optional_memoria"
  | "privileged_ferial"    // Advent/Christmas/Lent/Eastertide/Holy Week ferial
  | "ordinary_ferial"
```

---

## 9. Text Resolution (Fallback Chains)

For each slot in each Hour, the assembly algorithm applies the following fallback chains. The first non-absent value in the chain is used.

### 9.1 Slot-by-Slot Fallback Rules

| Slot | Solemnity | Feast | Memoria (ordinary day) | Ferial / Sunday |
|---|---|---|---|---|
| **Invitatory antiphon** | Saint proper → Common | Saint proper → Common | Saint proper → Common → Psalter | Seasonal proper → Psalter |
| **OoR hymn** | Saint proper → Common | Saint proper → Common | Saint proper → Common → Psalter (ad lib, §5.4) | Psalter (OorHymnSet: night/day) |
| **OoR psalmody** | Saint proper → Common | Saint proper → Common | Psalter (ferial) | Psalter |
| **OoR biblical reading** | Saint proper → Common | Saint proper → Common | Psalter / Seasonal (ferial) | Seasonal proper → Psalter |
| **OoR patristic/hagiographical reading** | Saint hagiographical proper → Common | Saint hagiographical proper → Common | Saint hagiographical proper → Seasonal/Psalter patristic (ferial; dubium *Notitiae* 12 (1976), 46) | Seasonal proper |
| ***Te Deum*** | **Always said** | **Always said** | **Never said** | Said on Sundays (outside Lent); not on ferial |
| **Lauds / Vespers hymn** | Saint proper → Common | Saint proper → Common | Saint proper → Common → Psalter | Seasonal proper → Psalter |
| **Lauds psalmody** | Sunday Week I (fixed) | Sunday Week I | Psalter (ferial), unless saint has proper antiphons | Psalter |
| **Lauds short reading** | Saint proper → Common | Saint proper → Common | Saint proper → Common → Seasonal proper → Psalter | Seasonal proper → Psalter |
| **Benedictus antiphon** | Saint proper → Common | Saint proper → Common | Saint proper → Common → Seasonal proper (cycle → plain) → Psalter | Seasonal proper (cycle → plain) → Psalter |
| **Lauds intercessions** | Saint proper → Common | Saint proper → Common | Saint proper → Common → Psalter | Seasonal proper → Psalter |
| **Lauds concluding prayer** | Saint proper → Common | Saint proper → Common | Saint proper (always) | Seasonal proper → Psalter |
| **1st Vespers psalmody** | Laudate series (Ps 112, 116, 134, 145, 146, 147); NT canticle from proper | — (no 1st Vespers) | — | Psalter |
| **2nd Vespers psalmody** | Saint proper → Common | Saint proper → Common | Psalter | Psalter |
| **Magnificat antiphon** | Saint proper → Common | Saint proper → Common | Saint proper → Common → Seasonal proper (cycle → plain) → Psalter | Seasonal proper (cycle → plain) → Psalter |
| **Vespers short reading** | Saint proper → Common | Saint proper → Common | Saint proper → Common → Seasonal proper → Psalter | Seasonal proper → Psalter |
| **Vespers intercessions** | Saint proper → Common | Saint proper → Common | Saint proper → Common → Psalter | Seasonal proper → Psalter |
| **Vespers concluding prayer** | Saint proper → Common | Saint proper → Common | Saint proper (always) | Seasonal proper → Psalter (§6) |
| **Daytime Prayer hymn** | Ferial (Psalter) | Ferial (Psalter) | Ferial (Psalter) | Seasonal proper → Psalter |
| **Daytime Prayer psalmody** | Complementary (gradual) + proper antiphon; Sunday Week I if on Sunday; special psalms if indicated | Ferial psalter psalmody | Ferial psalter psalmody | Current psalter |
| **Daytime Prayer short reading** | Saint proper → Common | Saint proper → Common | Ferial (Psalter) | Seasonal proper → Psalter |
| **Daytime Prayer concluding prayer** | Saint proper → Common | Saint proper → Common | Ferial (Psalter) | Seasonal proper → Psalter (§6) |
| **Compline psalmody** | Sunday (after 1st/2nd Vespers respectively) | Ferial | Ferial | Per Psalter day (§3.5) |
| **Compline concluding prayer** | Psalter (always) | Psalter (always) | Psalter (always) | Psalter (always) |
| **Marian antiphon** | By season (FixedTexts) | By season | By season | By season |

### 9.2 Privileged-Season Memoria Addendum (§5.5)

When `allow_memoria_addendum == true` (optional commemoration during 17–24 Dec, Christmas octave, or Lent ferials):

- **OoR**: the entire Office follows the seasonal ferial. After the seasonal patristic reading + responsory, **append** the saint's hagiographical reading + responsory (proper or from Common), then conclude with the saint's concluding prayer.
- **Lauds / Vespers**: the entire Hour follows the seasonal ferial. After the seasonal concluding prayer, **append** the saint's antiphon (*Benedictus* or *Magnificat*, proper or from Common) and the saint's concluding prayer.

### 9.3 Alleluia in Antiphons (§7)

During Eastertide, the assembly algorithm appends *Alleluia* to every antiphon, **except** those whose `suppress_alleluia` flag is set.

---

## 10. Assembly Context

Some slots cannot be resolved from data alone; they require runtime context supplied at assembly time.

```
AssemblyContext {
  // Which Hour(s) is/are being said today?
  // Affects complementary psalmody selection for Daytime Prayer.
  daytime_hours_said: ("terce" | "sext" | "none")[]

  // Does the Office of Readings begin the day's prayer?
  // If true, the Invitatory precedes OoR; otherwise OoR starts with
  // the introductory verse.
  oor_is_first_hour: boolean

  // If OoR is the first hour, is Lauds following immediately?
  // If true, Lauds' introductory verse is suppressed.
  lauds_follows_oor_directly: boolean

  // Is the Office of Readings being said at night (vs. during the day)?
  // Selects which OorHymnSet hymn to use in Ordinary Time.
  oor_said_at_night: boolean

  // Compline follows which Vespers context?
  // "after_first_vespers" → Sunday psalmody group A (Ps 4 + Ps 133)
  // "after_second_vespers" → Sunday psalmody group B (Ps 90)
  // "after_ferial_vespers" → ferial psalmody
  compline_follows: "after_first_vespers" | "after_second_vespers" | "after_ferial_vespers"

  // Calendar identifier (diocese, religious family, or universal)
  calendar_id: string
}
```

### 10.1 Per-Day Options (`DayOption` / `DayChoices`)

`AssemblyContext` holds *persistent* user settings; a liturgical day additionally
carries *per-day* choices whose valid values depend on the date and the data
(`src/types/options.ts`, enumerated by `enumerateDayOptions` in
`src/options/enumerate.ts`). Four kinds:

| Kind | Option id | Choice ids | Where applied |
|---|---|---|---|
| `celebration` | `celebration` | `feria`, `saint:<id>`, `bvm_saturday` | `resolveDay(date, calendarId, choices)` |
| `part_source` | `<hour>.<slot>.source` (e.g. `lauds.hymn.source`) | `common:<type>:<variant>`, `psalter`, `seasonal:<key>`, … | `resolveSource` on chains marked `adLibFrom` (office-spec §5.4) |
| `melody` | `<hour>.<slot>[...].melody` | melody ref ids (`<index>:<refId>` for duplicates) | `hydrateMelodies` / `selectMelodyRef` |
| `psalmody` | `<hour>.psalmody` (daytime hours) | `current`, `complementary` | `buildDay(day, context, choices)` |

`DayChoices` is a flat `Record<optionId, choiceId>` threaded as an optional
trailing parameter through `resolveDay` → `buildDay` → the assemblers'
`assemble*` methods. Contract:

- **Defaults**: an absent, unknown, or stale choice id silently falls back to
  the default; applying every option's `defaultChoiceId` is byte-identical to
  applying no choices at all.
- **Strict heads win**: a `part_source` choice only takes effect when the
  chain's strict head (the saint's proper text) yields nothing — propers are
  never choosable away (§5.4).
- **Cascade**: changing an upstream choice (celebration, a `.source` choice)
  can change which downstream options exist; callers re-enumerate after each
  change (`enumerateDayOptions` accepts the choices made so far).
- **Cross-hour psalmody exclusivity** (only one daytime hour takes current
  psalmody per day, GILH 80) is not enforced by the engine — it cannot know
  what was already prayed outside the current assembly.

Hour keys: `invitatory`, `officeOfReadings`, `lauds`, `terce`, `sext`, `none`,
`firstVespers`, `vespers`, `compline`. Slot keys are the runtime camelCase
field names without the `Ref` suffix (`hymn`, `benedictusAntiphon`,
`psalmSlots[0]`, `memoriaAddendum.antiphon`, …), shared between assemblers and
the enumerator via `src/options/slotTable.ts`.

Display labels for options come from the optional `labels.options` block in
`fixed_texts.yaml`, saint names from the sanctoral calendar entries, and
common-variant names from each `CommonVariant.label`.

The Saturday memoria of the BVM (§5.6) is backed by the calendar-less
`proper_of_saints/bvm_saturday.yaml` entry; slots without proper texts fall
back to the BVM common.

---

## 11. Summary of Collections and Approximate Sizes

| Collection | Key | Approx. entries | Notes |
|---|---|---|---|
| `psalms` | `Psalm.id` | 150 + 22 Ps-118 sections | Plus markers for omitted psalms |
| `canticles` | `Canticle.id` | ~35 | 24 OT ferial + 2 Sunday + 7 NT + 2 NT substitutes + 3 Gospel |
| `fixed_texts` | (singleton) | 1 | |
| `psalter` | `(week, day)` | 28 | Full ferial defaults for all Hours |
| `complementary_psalmody` | group id | ~5 | Gradual-psalm groups for Daytime Prayer |
| `proper_of_seasons` | `SeasonalDayKey` | ~280 | Sparse; privileged-season days have more fields populated |
| `calendars` | `calendar_id` | 1 universal + N particular | Sanctoral schedule; see §6.1 |
| `proper_of_saints` | saint id | ~200+ | Liturgical texts only; same `id` as §6.1 |
| `commons` | `CommonType` | ~8 types × 1–4 variants | Complete texts; no absent fields |

---

## 12. Extension Points

- **Particular calendars** — `calendars/local/<id>.yaml` overlays on the General Roman Calendar (additions, rank/date overrides, suppressions). The `calendar_id` in `AssemblyContext` selects the merged sanctoral schedule. Optional `proper_of_saints` texts use the same saint `id`.
- **Two-year supplement** — `proper_of_seasons` entries carry `_yr1` / `_yr2` variants for the optional two-year biblical reading cycle. The assembly algorithm selects based on `LiturgicalDay.reading_year`.
- **Three-year gospel-canticle antiphons** — seasonal `lauds` / `vespers` / `first_vespers` slots may carry `benedictus_antiphon_yr_a|b|c` and `magnificat_antiphon_yr_a|b|c` for the Sunday lectionary cycle (*Liturgia Horarum* editio typica altera). Assembly selects via `LiturgicalDay.sunday_cycle` before the plain antiphon field.
- **Optional Lectionary** — an additional collection of patristic reading alternatives per day, structured identically to the `patristic_reading` fields. The user/implementer selects whether to use the standard assignment or the Optional Lectionary reading.
- **Votive Offices** — a small collection of `VotiveOffice` entries (e.g., for the BVM, for peace, for the dead), each structured as a `CommonVariant`. Subject to the day-class restrictions of §spec-§18.
- **Vigil Canticles Appendix** — a collection of canticle sets keyed by `SeasonalDayKey` or solemnity, used when the vigil extension (§spec-§3.3) is celebrated.
