# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`@vagdur/loth` turns a date into a rendered Liturgy of the Hours. It is a
library, published to npm, with **no liturgical texts of its own**: the psalms,
antiphons, hymns and melodies live in a separate YAML data tree the host
supplies, and a real one is usually somebody's copyrighted translation.
`data/en/` in this repo is deliberate placeholder text (`[Week 2 Sunday Lauds
hymn, stanza 1]`) plus invented chant in `data/en/melodies/sample.yaml`, and it
exists so the tests can render every hour in every mode.

## Commands

```bash
npm test
```

`pretest` runs `validate:data` and `check:worker-safe` first, and both of those
run `npm run build`. Skip the preamble when iterating:

```bash
npx vitest run tests/unit/computus.test.ts
```

| Command | What it does |
| --- | --- |
| `npm run build` | `tsc` for `src/` (excluding `src/browser`) + `tsc -p tsconfig.browser.json` for `src/browser`. Typechecks `src/` only — **tests are never typechecked**. |
| `npm run check:worker-safe` | esbuild-bundles `dist/index.js` for a browser target; fails if a Node built-in reached the default entry point. |
| `npm run validate:data` | Structural check of `data/en/`. Takes `-- --fix` for the repairs it knows how to make. |
| `npm run test:watch` | Vitest watch. |
| `npm run test:fixtures:update` | Rewrite the golden `.tex` / `.html` / `.gabc` fixtures (`UPDATE_FIXTURES=1`, integration tests only). |
| `npm run test:fixtures:compile-pdf` | Refresh reference PDFs; separate config, excluded from `npm test`. |
| `npm run serve:hours` | Local harness at `localhost:5173` for eyeballing the HTML output (`date`, `hour`, `locale`, `mode`, `calendar` query params). Runs against `dist/`, so build first — the script does. |
| `npm run generate:data -- --locale xx` | Seed the shape of a new locale tree. |
| `npm run build:calendars` | Python; regenerates the sanctoral YAML from `scripts/grc_sanctoral_data.py`. Needs PyYAML. |

`npm test` includes LaTeX integration tests. They need `lualatex --shell-escape`
plus a `gregorio` binary whose major.minor matches the installed `gregoriotex`;
when that toolchain is missing the compile cases **skip** (probed once by
`tests/helpers/gregorioAutocompile.ts`) rather than fail, and the golden text
comparisons still run.

## The three layers

Everything flows one way, and the layers are not allowed to know about each
other's concerns:

1. **Calendar** (`src/calendar/`) — *what is celebrated*. `resolveDay(date,
   calendarId, choices?)` → `LiturgicalDay`: season, psalter week, celebration,
   and an `evening` telling you whether tonight is First Vespers of tomorrow.
   `resolveEvening` deliberately does not recurse into `resolveDay`.
2. **Hours** (`src/hours/`) — *which texts, in what order, as references*.
   `buildDay(day, context, choices?)` → `AbstractDay`. Every slot holds a
   `SlotSource` — a pointer into a data collection, or a `FallbackChain` of
   them. This layer knows liturgical rules and has no access to text.
3. **Assemblers** (`src/assemblers/`) — *resolve references and emit markup*.
   `HtmlAssembler`, `TexAssembler`, `PlainTextAssembler`, all
   `Assembler<string>`.

`PlainTextAssembler` is the reference implementation; `TexAssembler` and
`HtmlAssembler` mirror it **slot for slot**, and mirror each other element for
element (`liturgicalTex.ts` ↔ `liturgicalHtml.ts`). Changing what one emits
without the others is how the golden fixtures start disagreeing. Both scored
renderers number scores identically (`lauds-score-1`, restarting per hour) so a
`.tex` and its `.html` sibling can be compared score by score.

Two sidecars hang off the same pipeline: `src/options/` enumerates the genuine
choices a day admits (it builds the `AbstractDay` and walks its slots against
the repository), and `src/ordo/` summarizes days in prose for an Ordo document.

### `FallbackChain` and `adLibFrom`

A chain without `adLibFrom` is strict first-non-null. With it, sources
`[0, adLibFrom)` are strict precedence (proper texts always win) and the tail is
a rubrically *free* choice — that is what a `"<path>.source"` entry in
`DayChoices` selects among. Option ids are built from `src/options/slotTable.ts`
by both the enumerator and the assemblers, so they cannot diverge. Stale or
unknown choice ids are always ignored and fall back to the default; a bad choice
set can never produce an invalid office.

## Entry points and the Worker-safety rule

| Entry | Module | Constraint |
| --- | --- | --- |
| `@vagdur/loth` | `src/index.ts` | **No Node built-ins anywhere in its reachable graph.** |
| `@vagdur/loth/node` | `src/node.ts` | `fs`, `path`, `js-yaml`, `child_process` live here. |
| `@vagdur/loth/browser` | `src/browser/lothChant.ts` | The only DOM-touching code; built by `tsconfig.browser.json`. |
| `@vagdur/loth/kln` | `src/kln/index.ts` | Chant review loop; also Worker-safe. |

This split is enforced, not aspirational — `check:worker-safe` fails the build
if `fs` or `path` reappears under `src/index.ts`. The pattern shows up
repeatedly: `data/repository.ts` (pure, `fromBundle`/`toBundle` only) beside
`data/repositoryNode.ts` (reads the YAML tree), and
`calendar/sanctoralRegistry.ts` beside `calendar/sanctoralRegistryNode.ts`. A
filesystem-less host gets its data from a bundle produced at publish time.
`assemblers/types.ts` re-exports `DataRepository` **type-only** for the same
reason — a value re-export would drag the Node loader chain into every
assembler.

`withSanctoralRegistry(registry, fn)` scopes the ambient calendar around a
synchronous render. Anything serving more than one locale must use it;
`initSanctoralRegistry` sets a global and will let one request change the
calendar under another. Tests use the global (`tests/setup.ts`).

## The specs are normative

There are three levels, and they defer upward:

1. **`GILH.pdf`** at the repository root — the General Instruction of the
   Liturgy of the Hours, the actual normative document. Bare paragraph
   citations in the code (`GILH 239`) point here.
2. **`office-spec.md`** — a working specification *derived from* the GILH: the
   structure of the office and the rules for choosing texts, with GILH
   paragraph numbers in parentheses throughout. It is a restatement for
   implementation, not an authority of its own; where it and `GILH.pdf`
   disagree, the PDF wins and `office-spec.md` is the thing to fix.
3. **`data-structure.md`** — the data model: the fallback chains in §9, the
   option model in §10.1. Cites `office-spec.md` sections in parentheses.

Code cites all of these inline — `office-spec §5.4`, `data-structure.md §9`,
`GILH 239` — and new liturgical logic should carry the same kind of citation.
When behavior and spec disagree, decide which is wrong rather than papering over
it in code.

`GILH.pdf` is reference material, not ours to redistribute: it is excluded from
the npm tarball by the code-only allowlist in `files` (see Publishing below),
and nothing in `src/` or `data/` should quote it at length.

`docs/` covers the output formats: `html-output.md`, `gregorio-pdf.md` (the
semantic macro table; style lives in `tex/loth.sty`, never in generated `.tex`),
`gabc-notation.md`.

## Conventions

- TypeScript is strict, plus `noUncheckedIndexedAccess` and
  `exactOptionalPropertyTypes` — hence the `...(x ? { x } : {})` spreads for
  optional fields.
- NodeNext resolution: relative imports carry a `.js` extension even from `.ts`.
- Tests import from `src/*.ts` directly, never from `dist/`. Scripts under
  `scripts/` import from `dist/`.
- YAML uses `snake_case`; `camelCaseKeys` in `repositoryNode.ts` converts on
  load, so the TypeScript types are camelCase throughout.
- Rubric words (`Ant.`, `℣.`, `℟.`) come from the data tree's
  `fixed_texts.yaml`, not from code. Changing how something *looks* means
  `tex/loth.sty` or `html/loth.css`; changing the *word* means the data.
- Commit subjects are plain sentences describing the change ("Take First Vespers
  psalmody from the Common, not from a bare psalm") — no conventional-commit
  prefixes.

## Publishing

`files` in `package.json` is a code-only allowlist, and
`scripts/assert-no-data-in-tarball.mjs` (wired to `prepublishOnly`) re-checks
the built tarball against its own allowlist. npm publishes are irrevocable and a
data directory in the tarball would be someone else's copyrighted text, so
neither of those is a formality — do not loosen them.
