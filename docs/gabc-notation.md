# GABC Notation Reference

GABC is the plain-text notation format used by [Gregorio](https://gregorio-project.github.io/) to typeset Gregorian chant. A `.gabc` file contains a metadata header (fields like `name:`, separated from the score by `%%`) followed by the score body.

## File structure

```
name: Antiphon title;
%%
(clef) syl(notes)la(notes)ble(notes) (,) next(notes)word.(notes)
```

Each syllable of the text is written immediately before the parenthesised note group that belongs to it. A `( )` token with no preceding text is a standalone element (barline, rest, or psalm-tone pitch token).

---

## Staff positions and clefs

GABC uses the letters **a–m** to identify the thirteen staff positions from the very bottom to well above the top line of a four-line chant staff:

| Letter | Position |
|--------|----------|
| a | space below the bottom line |
| b | bottom line (line 1) |
| c | space 1 (between lines 1–2) |
| d | line 2 |
| e | space 2 (between lines 2–3) |
| f | line 3 |
| g | space 3 (between lines 3–4) |
| h | line 4 (top line) |
| i | space above the top line |
| j–m | further above the staff |

The **clef** at the start of the score declares which staff position is *do* (C):

| Clef | *Do* sits on… | Practical pitch at position h |
|------|--------------|-------------------------------|
| `c4` | line 4 = **h** | C (do) |
| `c3` | line 3 = **f** | E (mi) |
| `c2` | line 2 = **d** | G (sol) |
| `f4` | line 4 = **h**, but for fa clef | F (fa) |

Because GABC letters are fixed to *visual* staff positions regardless of clef, the same letter denotes a different absolute pitch depending on the declared clef. For example, position `h` is C in `c4` but E in `c3`. Switching between `c3` and `c4` shifts every letter by two positions and changes absolute pitch by a major third.

---

## Accidentals

Accidentals are written as a suffix on the note letter they modify. The flat or natural sign is rendered as a separate visual symbol at that staff position, followed by the note itself — so a flat note at position `i` is written as **two characters**: `ix` (the flat sign drawn at position i) then `i` (the notehead):

| Suffix | Meaning | Example |
|--------|---------|---------|
| `x` | flat ♭ | `ix` = flat sign at position i; `ixi` = flat sign + note i (one flat note fully notated) |
| `y` | natural ♮ | `iy` = natural sign; `iyi` = natural sign + note i |
| `#` | sharp ♯ | `f#` = sharp sign; `f#f` = sharp sign + note f |

A **key-signature flat** at the left edge of every staff row applies that flat to all notes at that pitch throughout the row.

---

## Punctum quadratum and punctum inclinatum

A lowercase pitch letter is a **punctum quadratum** — the ordinary square note. An **uppercase** letter is a **punctum inclinatum**, the diamond note that neumatic notation uses on the way down:

```
(fgFED)   ← f, g, then a climacus: the quadratum g descends through F E D
(hiHGe)   ← the descent stops at G; g→e is a third, so e is square again
(dc)      ← a two-note descent is a clivis, and stays square
```

The convention is that a stepwise descent of **three or more notes inside one neume**, counting the note the descent starts from, is written with inclinata after that first note. Descents that leap, descents of only two notes, and notes belonging to separate syllables are unaffected — they are separate neumes however they happen to be moving.

Only a punctum quadratum can become an inclinatum: a virga, oriscus, quilisma or stropha is a different notehead and ends the descent. Marks that leave the notehead alone (`_`, `.`, `'`) ride along on an inclinatum.

A transcription pipeline is expected to apply this rule as it emits GABC; the library renders whatever it is given.

---

## Note-shape modifiers

These single characters are appended directly after a note letter (before any accidental on the *next* note):

| Suffix | Name | Meaning |
|--------|------|---------|
| `.` | punctum mora | Rhythmic augmentation dot — doubles the note's duration |
| `_` | horizontal episema | A short horizontal line above the note indicating slight lengthening or rhythmic stress (the Solesmes *ictus*) |
| `'` | vertical episema / ictus | A small vertical tick below the note (rhythmic *ictus*) |
| `'0` / `'1` | forced ictus | Forces the ictus below (`0`) or above (`1`) the note |
| `~` | liquescent | A small diminutive note attached to the main note (written as a smaller neume); indicates a semi-vocal closing consonant |
| `w` | quilisma | A trembling/wavy note, always ascending; written between two other notes in a neume |
| `o` / `o0` | oriscus | An oriscus (repeated repercussion note) pointing down |
| `o1` | oriscus up | Oriscus pointing up |
| `s` | stropha | Stropha note shape |
| `v` / `V` | virga | Virga stem on right (`v`) or left (`V`) |

---

## Empty-note forms (r, R, r0 …)

These suffixes produce visually special noteheads used in psalm-tone notation and elsewhere to mark structural roles:

| Suffix | Name | Typical use in psalm tones |
|--------|------|---------------------------|
| `r` | punctum cavum | Hollow (open) note |
| `R` | linea punctum | Note with a horizontal bar through it — marks the **termination** note of a cadence |
| `r0` | linea punctum cavum | Open note with horizontal bar — marks the **reciting tone** (tenor; the note on which most syllables are chanted) |
| `r1` | accentus | A small square accent mark above the note — placed on the note that falls under the **accented syllable** of the cadence formula |
| `r2` | reversed accentus | Accent mark pointing the other way |
| `r3–r5` | circulus / semi-circuli | Various circular accent marks |

In printed chant books these are realised as distinct notehead shapes:
- Oriscus (wider polygon) → `r0` (reciting tone)
- Virga (heavier-stroked square) → `R` (termination note)
- Small accent square above the staff → `r1` (accented cadence note)

---

## Barlines (divisiones)

Barlines appear as standalone tokens `(symbol)` between syllables:

| Symbol | Name | Meaning |
|--------|------|---------|
| `,` | divisio minima (quarter bar) | Very short breath; minimum rhythmic subdivision |
| `;` | divisio minor (half bar) | Mediant cadence in psalm tones; moderate breath |
| `:` | divisio maior (full bar) | End of a phrase |
| `::` | divisio finalis (double bar) | End of piece or major section |

The backtick **`` ` ``** (grave accent), written as `` (`) ``, produces a **quarter bar** identical in effect to `(,)` but without adding a punctum mora dot to the preceding note. It is used in the Gloria Patri and other places where a breath break is needed but the preceding note should not be lengthened.

---

## Neume grouping and spacing

Notes within a single `( )` group are sung together as one neume. The transcriber writes them as a sequence of note letters, uppercase where a descent takes puncta inclinata (see above):

```
(gh)     ← two-note ascending neume (pes/podatus): g then h
(hg)     ← two-note descending neume (clivis): h then g
(ghi)    ← three-note ascending (scandicus)
(hGF)    ← three-note descending (climacus): quadratum h, then two inclinata
(ixgi)   ← flat-i, g, i  (three-note neume with accidental on first note)
```

Spacing and connection modifiers inside a group:

| Symbol | Meaning |
|--------|---------|
| `!` | Zero-width separator (no visual space between notes, but no beam connection) |
| `/` | Neumatic cut (small space between notes within one syllable) |
| `//` | Large neumatic cut |
| `@` | Fusion (connect two notes with a slur) |

---

## Choral signs

`[cs:t]` placed after a note produces a **choral sign** (signum congruentiae) of type `t`. `[cs:c]` conventionally marks the point in an antiphon where the score connects back to the psalm tone — effectively a repeat/return sign for the choir.

---

## Psalm tone GABC conventions

A psalm tone is encoded without syllable text: each structural note appears as its own `(token)`. The standard layout is:

```
(clef) (intonation_notes) (tenor_r0) (cadence_notes…) (;) (tenor_r0) (cadence_notes…) (::) (doxology_notes) (,)
```

- **Intonation**: one or more plain-note tokens at the start (sung only on the first verse)
- **Tenor / reciting tone**: note with `r0` suffix (linea punctum cavum)
- **Mediant cadence**: ends with `(;)` half-bar
- **Termination cadence**: ends with `(::)` double bar
- **Doxology flex**: the trailing `(,)` quarter-bar after the final `(gR)` etc.

Accent marks (`r1`) show which cadence note coincides with the **tonic accent** of the text. Termination notes bear `R` (linea punctum).

---

## Line breaks and custos

- `(z)` — forced justified line break
- `(Z)` — forced unjustified line break
- The custos (guide note at the end of each staff row) is produced automatically by Gregorio and need not be written explicitly.

---

## Sources

- [GABC Notation](https://gregorio-project.github.io/gabc/) — Gregorio project overview
- [GABC Details](https://gregorio-project.github.io/gabc/details.html) — full syntax reference
- [GABC Tutorial](https://gregorio-project.github.io/tutorial/tutorial-gabc-01.html)
- [GABC Psalm Tone FAQ](https://bbloomf.github.io/jgabc/faq.html)
