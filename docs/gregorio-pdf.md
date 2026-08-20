# LaTeX / Gregorio PDF output

The [`TexAssembler`](../src/assemblers/texAssembler.ts) builds a UTF-8 `.tex` file for **every liturgical hour** — Office of Readings, Lauds, Daytime Prayer (Terce/Sext/None), Vespers, and Compline — plus a full-day document (`assembleDay`) that lays out all the day's hours in one PDF, separated by `\clearpage`. It uses **semantic markup** (roles such as `\antiphon`, `\versicle`, `\response`). Visual formatting lives in [`tex/loth.sty`](../tex/loth.sty), not in the generated `.tex`. It mirrors [`PlainTextAssembler`](../src/assemblers/plainText.ts) slot-for-slot for liturgical structure and unscored text (the reference implementation).

When a slot carries GABC scores, sung lyrics render via Gregorio only; redundant plain macros for that slot are omitted so lyrics are not duplicated in the PDF.

Split GABC (introductory verse, short responsory, blessings, dismissals) is stored as named sections and **merged into one score** for display: openings and closings become a single block with ℣./℟. labels, and the short responsory is reassembled into the printed R. / V.+repeat / V. Gloria + full R. layout. See [`gabcDisplay.ts`](../src/assemblers/gabcDisplay.ts).

GABC from the data model (`Melody.gabc`, `Antiphon.psalmTone`, the gospel-canticle `Antiphon.firstVerse` incipit, canticle melodies) is embedded with the LaTeX `filecontents` environment so Gregorio can read sibling `.gabc` files when you run **LuaLaTeX**. The first-verse score is omitted in text-only output: its lyrics are the canticle's opening line.

`npm run build` does **not** require TeX. Producing a PDF is optional and needs a working **LuaLaTeX** installation plus **Gregorio** (GregorioTeX).

## Content vs style

| Layer | Location | Responsibility |
| ----- | -------- | ---------------- |
| Content | Generated `.tex` | Liturgical text, structure, GABC `filecontents`, semantic macros |
| Style | `tex/loth.sty` | Fonts, spacing, bold rubric symbols, Gregorio score rendering |

Locale-specific rubric strings (e.g. `Ant.`, `℣.`, `℟.`) come from [`fixed_texts.yaml`](../data/en/fixed_texts.yaml) and are injected at the top of the document via `\LothRubrics*` commands. To change how an antiphon *looks*, edit `loth.sty`; to change the prefix *word*, edit the data labels.

**Compile requirement:** copy `tex/loth.sty` into the same directory as the `.tex` file (the integration test does this automatically via [`copyLothSty`](../src/tools/compileTex.ts)).

## Semantic macros

Defined in `loth.sty` and emitted from [`liturgicalTex.ts`](../src/assemblers/liturgicalTex.ts):

| Macro | Role |
| ----- | ---- |
| `\hourHeading{title}` | Hour title |
| `\sectionHeading{title}` | Section title |
| `\antiphon{text}` | Antiphon (prefix from rubrics) |
| `\versicle{text}` / `\response{text}` | Dialogue lines |
| `\hymn` / `\hymnStanza` | Hymn stanzas |
| `\psalmText{text}` | Psalm or canticle verses |
| `\shortReading{ref}{text}` | Short reading |
| `\reading{attribution}{text}` | Long reading (Office of Readings) |
| `\shortResponsory{R}{V}{R}` | Short responsory (also used for the long responsory) |
| `\gospelCanticle{ref}{text}` | Gospel canticle |
| `\teDeum{text}` | Te Deum |
| `\intercessionsIntro`, `\intercessionsResponse`, `\intention{V}{R}` | Intercessions |
| `\lordsPrayerSection{title}{text}` | Our Father block |
| `\concludingPrayer{rubric}{text}` | Concluding prayer |
| `\examinationOfConscience{text}` | Compline examination of conscience |
| `\complineBlessing{text}` | Compline blessing |
| `\dismissal{verse}{response}` | Dismissal |
| `\melodyRubric{text}` | Editorial note (mode belongs on the GABC `mode:` header, never as a caption) |
| `\lothScore{basename}` / `\psalmToneScore{basename}` | Gregorio scores |

## Integration tests (LaTeX + PDF)

From the repository root, `npm test` runs Vitest integration tests that compare assembled TeX to golden fixtures. It does **not** invoke LuaLaTeX. To compile every golden `.tex` with **LuaLaTeX** (with `--shell-escape`, needed for GregorioTeX auto-compilation) and assert success:

```powershell
npm run test:fixtures:compile
```

That suite copies `loth.sty` beside each fixture and runs LuaLaTeX (often twice). Score-bearing fixtures reuse `tests/fixtures/.compile-cache/` so unchanged GABC is not recompiled every run.

The fixtures cover the one locale in the repository: `en`, placeholder text whose invented melodies (`data/en/melodies/sample.yaml`) carry GABC, so the fixtures also exercise the `filecontents` → GregorioTeX score path. Golden `.tex` and reference `.pdf` files live under [`tests/fixtures/`](../tests/fixtures/), named `<hour>-<locale>-2026-05-10-general.{tex,pdf}` (for example `lauds-en-…`, `day-en-…`), with `-plain`/`-scored` suffixes for the non-hybrid output modes. The default suite compares generated TeX to the fixture text; it does **not** byte-compare PDFs. Refresh committed PDF previews with `npm run test:fixtures:compile-pdf`.

The score-bearing **compile** tests need a working GregorioTeX toolchain: `lualatex --shell-escape` **and** a `gregorio` binary whose major.minor matches the installed `gregoriotex` package. When that isn't available (e.g. a stale MiKTeX whose `gregorio` binary lags the package), those cases **skip** rather than fail; all golden `.tex` comparisons still run under `npm test`. The skip is decided by a one-off probe (`tests/helpers/gregorioAutocompile.ts`).

To rewrite the TeX (and HTML / GABC) fixtures:

```powershell
npm run test:fixtures:update
```

That does not require LuaLaTeX. To also refresh reference PDFs afterward, run `npm run test:fixtures:compile-pdf` with LuaLaTeX + Gregorio on `PATH`.

## Install LuaLaTeX + Gregorio (Windows)

1. Install a TeX distribution that includes **LuaLaTeX**, for example [MiKTeX](https://miktex.org/) or [TeX Live](https://tug.org/texlive/).
2. Install **Gregorio** for your distribution and ensure `gregorio.exe` and GregorioTeX files are on the search path used by MiKTeX/TeX Live. Follow the [Gregorio installation guide](https://gregorio-project.github.io/installation.html) for Windows.
3. Open a **new** PowerShell window so `PATH` picks up the TeX binaries, then check:

   ```powershell
   lualatex --version
   ```

4. If `--compile` fails with missing `gregoriotex` or Gregorio errors, update TeX packages (MiKTeX Package Manager / `tlmgr`) until `\usepackage{loth}` resolves (the package loads `gregoriotex`).

## Notes

- The plain-text placeholder `[Benedictus text — Lk 1:68-79]` matches [`PlainTextAssembler`](../src/assemblers/plainText.ts) until the Gospel canticle text is wired into data.
- GABC is written literally into `filecontents` blocks; avoid placing the substring `\end{filecontents}` inside real GABC sources.
- Machines without TeX can still pass `npm test`. Run `npm run test:fixtures:compile` (or `test:fixtures:compile-pdf`) on a TeX-capable machine when you change generated TeX, `loth.sty`, or Gregorio-related tooling.
