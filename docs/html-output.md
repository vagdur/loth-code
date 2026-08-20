# HTML output

The third output format for the hours, alongside plain text and `.tex`. It
mirrors the LaTeX renderer slot-for-slot, but the chant is rendered in the
browser by [`@vagdur/exsurge`](https://github.com/vagdur/exsurge) and can be
played back: click a note and it sings from there.

The package ships the pieces for putting an hour on a page. It does not ship a
site — `scripts/serve-hours.mjs` is a local harness for checking the output,
not part of the library.

## The three layers

| Layer | Where | What it is |
| --- | --- | --- |
| Markup | `src/assemblers/htmlAssembler.ts` | `HtmlAssembler implements Assembler<string>` — the mirror of `TexAssembler`. Pure string generation; runs anywhere. |
| Runtime | `src/browser/lothChant.ts` → `dist/browser/lothChant.js` | `mountScores` / `renderHour` — the only DOM-touching code. Hands each score to exsurge. |
| Presentation | `html/loth.css` | The mirror of `tex/loth.sty`: the assembler emits semantic class names, this file decides how they look. Rubrics and labels (except the hour title) are red; spoken text is black. |

```ts
import { HtmlAssembler } from "loth/dist/assemblers/htmlAssembler.js";

const assembler = new HtmlAssembler({ outputMode: "hybrid" });
const html = assembler.assembleLauds(day.lauds, repo);
```

```js
import { mountScores } from "loth/dist/browser/lothChant.js";

container.innerHTML = html;              // or: renderHour(container, html)
const scores = mountScores(container);   // [{ id, element, ready, player }]
```

`mountScores` returns synchronously; exsurge lays out asynchronously, so await
`score.ready` (or `Promise.all(scores.map((s) => s.ready))`) if you want the
players. `unmountScores(root)` tears them down and releases their audio
resources.

## Output modes

The same three as `TexAssembler`, and they mean the same things:

- `hybrid` (default) — scores where a melody exists, plain markup as fallback
- `plain` — never emit GABC; a readable text page with no notation
- `scored` — scores only; unscored prose omitted, antiphon once per psalm slot

Score ids follow the LaTeX numbering (`lauds-score-1`, restarting per hour), so
an HTML page and its `.tex` sibling can be compared score for score.

## GABC travels inline

Where the LaTeX path writes sibling `.gabc` files and references them with
`\lothScore{lauds-score-1}`, the HTML path puts the notation in the markup:

```html
<div class="loth-score" data-loth-score data-score-id="lauds-score-1"
     data-gabc="name:lauds-score-1;&#10;%%&#10;(c4) Gud,(j) kom(j) …"></div>
```

so an assembled page is self-contained. `assembler.getScores()` returns the same
GABC keyed by score id, for hosts that would rather pre-render server-side with
exsurge's `createSvgTree` than mount in the browser.

Split GABC (hour openings, short responsories, closings) is merged into one
score per slot before it is inlined, so the page matches the printed layout
rather than the storage sections. Gospel-canticle antiphons that carry a
pointed first-verse GABC part emit that score between the psalm tone and the
canticle text; it is omitted in `plain` mode, where the lyrics would only
repeat the canticle's opening line.

## Loading exsurge

`dist/browser/lothChant.js` keeps a bare `@vagdur/exsurge` specifier. Resolve it
however your host resolves modules — a bundler, or an import map:

```html
<script type="importmap">
{"imports": {"@vagdur/exsurge": "/vendor/exsurge/dist/exsurge.mjs"}}
</script>
```

`wrapLothHtmlDocument` emits that map by default (`importMap: false` turns it
off when a bundler is doing the work). `exsurgeModulePath()` in
`src/tools/htmlAssets.ts` locates the file to serve.

## Presentation

`html/loth.css` is the counterpart of `tex/loth.sty`. The two should move
together: same colour split, same heading hierarchy, each in the idiom of its
format (a web column vs. a printed page).

- **Do the red, say the black.** `.loth-section-heading`, `.loth-rubric`
  (`Ant.`, ℣., ℟.), `.loth-reference`, `.loth-let-us-pray`,
  `.loth-melody-rubric` and `.loth-psalm-tone-label` are `--loth-rubric`.
  Spoken and sung text is `--loth-text`. The hour title (`.loth-hour-heading`
  and `.loth-day-heading`) is the exception among labels: it stays black.
- **Section headings** (`HYMN`, `PSALMODY`, `READING`, …) come from
  `fixed_texts.yaml` `labels.sections` and are emitted by all three assemblers.
  A heading is omitted when its body would be empty (scored-only slots with no
  melody).
- Chant ℣./℟. and the GABC mode annotation use the same rubric colour
  (`ChantContext.setRubricColor` in `lothChant.ts`; `\grechangestyle{annotation}`
  and `\Vbar`/`\Rbar` in `loth.sty`).

## Drop caps

Each lyric score is handed to exsurge with `useDropCap` on, matching Gregorio's
default (and the PDF path): the first letter sits to the left of the staff as a
large initial, and the remaining lyrics start under the staff. Psalm tones leave
it off — they have no lyrics to take an initial from. Merged dialogues whose
first lyric is a ℣/℟ glyph (`<sp>V/</sp>`) likewise have nothing to take, so
none is drawn. Hosts calling `renderScore` can override with `useDropCap` on
the options.

Gregorio places a `mode:` header above that initial automatically; exsurge
(≥ 1.29.4) does the same. The assemblers write `mode: N;` into the GABC when
the melody has a mode. Mode is a property of the melody, not of the text, so
it is never a `loth-melody-rubric` caption — including in `plain` output,
where there is no score to carry the header. Psalm tones and header-less
dialogues stay caption-free. Hosts calling `renderScore` can still override
the derived annotation with `annotation` on the options.

## Fonts

exsurge draws ℣, ℟ and similar glyphs in a font family named
**`Exsurge Characters`**; without it the browser substitutes something else.
`html/loth.css` declares the `@font-face` pointing at `./ExsurgeChar.otf`, so
the font must sit next to the stylesheet. `copyLothCss(dir)` puts both there —
the counterpart of `copyLothSty`.

## Playback

exsurge's player has no interface of its own, and neither does this runtime:
clicking a note plays from there, clicking again stops, and the sounding note is
highlighted. Build your own controls on the handles:

```js
const [score] = mountScores(container);
const player = await score.ready;
speedSlider.oninput = () => player.setSpeed(Number(speedSlider.value));
```

`setSpeed`, `setTuning`, `setTranspose`, `setInstrument` and `setVolume` are all
safe to call mid-playback. Player options go through `mountScores`:

```js
mountScores(container, { player: { speed: 90, instrument: "piano" } });
```

**Browsers only start audio inside a user gesture.** Clicking a note satisfies
that by itself; a play button of your own must call `player.unlock()` from its
own click handler first.

## Checking it locally

```bash
npm run serve:hours
```

Then <http://localhost:5173/>, with `date`, `hour`, `locale`, `mode` and
`calendar` query parameters. The picker header and speed slider on that page are
the demo host's, not the package's — they are there to show the handles being
used.

## Tests

- `tests/integration/htmlAssembler.test.ts` — golden `.html` per hour × locale ×
  mode. Regenerate with `npm run test:fixtures:update`.
- `tests/integration/htmlScoresRender.test.ts` — every emitted score is parsed,
  laid out and turned into a playback timeline by exsurge running headless in
  Node (no jsdom, no browser: `ChantContext` falls back to opentype.js for text
  measuring). This is what catches GABC that renders as silence or as nothing.
