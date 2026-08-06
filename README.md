# @vagdur/loth

Assembles the Liturgy of the Hours. Given a date and a calendar, it works out
which celebration falls that day, resolves every slot of every hour against a
tree of liturgical texts, and renders the result as HTML, LaTeX or plain text.
The work happens in three layers: the calendar decides *what* is celebrated,
the hours layer decides *which texts* each hour draws on and in what order —
as references, not yet as text — and an assembler resolves those references
and produces markup. Chant is carried as [GABC][gabc] and drawn in the browser
by [`@vagdur/exsurge`][exsurge], which can also sing it back.

**This package contains code only — no liturgical texts.** The psalms,
antiphons, hymns and melodies live in a separate data tree that you supply,
and much of that material is under copyright that does not permit
redistribution. `@vagdur/loth/node` reads such a tree from disk; hosts without
a filesystem (a Cloudflare Worker, say) instead load a bundle produced by
`readRepoBundle` at publish time. Everything reachable from the default entry
point is free of Node built-ins, so it bundles for a browser or a Worker
without polyfills; `npm run check:worker-safe` is what keeps that true.

The `data/en/` tree in this repository is **not** an office anyone can pray. It
is placeholder text — `[Week 2 Sunday Lauds hymn, stanza 1]` — with invented
chant in `data/en/melodies/sample.yaml`, and it exists so the test suite can
render every hour, in every output mode, with and without scores. Point the
library at a real tree to get a real office; `npm run generate:data --
--locale xx` seeds the shape of a new one.

```ts
import { HtmlAssembler, buildDay, defaultContext, resolveDay, utcDate,
         withSanctoralRegistry } from "@vagdur/loth";
import { loadRepository, loadSanctoralRegistry } from "@vagdur/loth/node";

const repo     = await loadRepository("./data", "sv");
const registry = await loadSanctoralRegistry("./data", "sv");

const html = withSanctoralRegistry(registry, () => {
  const day = buildDay(resolveDay(utcDate(2026, 5, 10), "general"),
                       defaultContext("general"));
  return new HtmlAssembler({ outputMode: "hybrid", fragmentOnly: true })
    .assembleLauds(day.lauds, repo);
});
```

Then mount the scores, client-side, so they render and play:

```js
import { mountScores } from "@vagdur/loth/browser";
container.innerHTML = html;
const scores = await Promise.all(mountScores(container).map((s) => s.ready));
```

| Entry point | What it holds |
| --- | --- |
| `@vagdur/loth` | Calendar, hours, assemblers. No Node built-ins. |
| `@vagdur/loth/node` | Reading the data tree, exsurge's asset paths, LaTeX compilation. |
| `@vagdur/loth/browser` | `mountScores` — the only DOM-touching code. |
| `@vagdur/loth/loth.css` | Presentation for the emitted class names. Ships with `ExsurgeChar.otf` beside it, which the `@font-face` expects. |

`withSanctoralRegistry` scopes the ambient calendar around a synchronous
render. A server handling more than one locale must use it rather than
`initSanctoralRegistry`, whose global would otherwise let one request change
the calendar out from under another.

MIT licensed.

[gabc]: https://gregorio-project.github.io/gabc/
[exsurge]: https://github.com/vagdur/exsurge
