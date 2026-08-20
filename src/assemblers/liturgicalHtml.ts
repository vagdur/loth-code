/**
 * Semantic markup — role-based class names only; formatting lives in
 * html/loth.css. The direct counterpart of liturgicalTex.ts, element for
 * element, so the two renderers stay slot-for-slot comparable.
 *
 * These builders return `LothNode`s rather than HTML strings. `renderHtml` in
 * tree.ts turns a finished tree into exactly the markup they used to build by
 * hand; a host that renders the tree itself gets the scores as data instead of
 * having to find them in markup afterwards. See tree.ts for why that matters.
 *
 * One divergence from the LaTeX side: rubric strings (`Ant.`, `℣.`, `℟.`,
 * `Let us pray.`, the psalm-tone label) are baked straight into the markup.
 * TeX needs `\LothRubrics*` configuration macros because macros are late-bound;
 * this output is final, so there is no counterpart to `emitLothRubrics`.
 */

import type { DataRepository } from "../data/repository.js";
import { formatOrdoDayHeadline } from "../ordo/headline.js";
import type { LiturgicalDay } from "../types/calendar.js";
import type { LiturgicalFlags } from "../types/hours.js";
import type {
  Antiphon, Hymn, Intercessions, LongResponsory, ShortResponsory, Versicle,
} from "../types/texts.js";
import type { GospelCanticleKind } from "../types/texts.js";
import {
  alleluiaAntiphonSuffix,
  formatResponseLinePlain,
  formatVersicleLinePlain,
  getLabels,
  includesLetUsPrayRubric,
  type HourLabelKey,
  type SectionLabelKey,
} from "./labels.js";
import {
  formatComplineBlessingPlain,
  formatDismissalPlain,
  formatExaminationOfConsciencePlain,
  formatIntroductoryVersePlain,
  formatInvitatoryVersePlain,
  formatLordsPrayerPlain,
  formatOorAcclamationPlain,
  formatTeDeumPlain,
} from "./liturgicalText.js";
import { escapeHtmlAttr, escapeHtmlText } from "./htmlEscape.js";
import {
  block,
  el,
  fragment,
  text,
  type LothElement,
  type LothNode,
  type MaybeNode,
  type ScoreSpec,
} from "./tree.js";

// ---------------------------------------------------------------------------
// Low-level builders
// ---------------------------------------------------------------------------

/** One `<p class="…">text</p>`. */
function p(className: string, content: string): LothElement {
  return el("p", { class: className }, text(content));
}

/**
 * Render a plain-text block as paragraphs: blank lines separate `<p>`s, single
 * newlines become `<br>` inside one. This is what LaTeX does with the same
 * string, so both renderers break the text in the same places.
 *
 * A paragraph is dropped only when it is a single empty line — several empty
 * lines still produce the `<br>`s between them, as the string version did.
 */
function prose(className: string, source: string): LothNode | null {
  const paragraphs = source
    .split(/\n{2,}/)
    .map((para) => para.split("\n"))
    .filter((lines) => !(lines.length === 1 && lines[0] === ""))
    .map((lines) => {
      const parts: MaybeNode[] = [];
      lines.forEach((line, i) => {
        if (i > 0) parts.push(el("br", {}));
        parts.push(text(line));
      });
      return el("p", { class: className }, ...parts);
    });
  return fragment(paragraphs, "\n");
}

/** A rubric symbol (`℣.`, `Ant.`, …) followed by its line of text. */
function rubricLine(className: string, symbol: string, content: string): LothElement {
  return el(
    "p",
    { class: className },
    el("span", { class: "loth-rubric" }, text(symbol)),
    text(` ${content}`),
  );
}

/** A block element: children on their own indented lines, nothing if empty. */
function wrap(tag: string, className: string, ...children: MaybeNode[]): LothElement | null {
  return block(tag, { class: className }, ...children);
}

// ---------------------------------------------------------------------------
// Elements (one per liturgicalTex.ts macro)
// ---------------------------------------------------------------------------

export function htmlHourHeading(
  repo: DataRepository,
  key: HourLabelKey,
  liturgicalDay?: LiturgicalDay,
  calendarId = "general",
): LothElement {
  const hour = getLabels(repo).hours[key];
  const ordoLabels = repo.getAssemblerLabels().ordo;
  const title = liturgicalDay && ordoLabels
    ? `${hour} - ${formatOrdoDayHeadline(liturgicalDay, ordoLabels, calendarId)}`
    : hour;
  return el("h1", { class: "loth-hour-heading" }, text(title));
}

export function htmlSectionHeading(repo: DataRepository, key: SectionLabelKey): LothElement {
  return el(
    "h2",
    { class: "loth-section-heading" },
    text(getLabels(repo).sections[key]),
  );
}

export function htmlAntiphon(
  repo: DataRepository,
  a: Antiphon,
  flags: LiturgicalFlags,
): LothElement {
  const alleluia = alleluiaAntiphonSuffix(repo, flags, a.suppressAlleluia);
  return rubricLine("loth-antiphon", getLabels(repo).rubrics.antiphonPrefix, a.text + alleluia);
}

/**
 * Editorial note. Mode is a property of the melody — written as a GABC
 * `mode:` header above the drop cap when a score is mounted — not of the
 * text, so it is never a `loth-melody-rubric` caption.
 */
export function htmlMelodyRubric(m?: { mode?: number; note?: string }): LothElement | null {
  if (!m?.note) return null;
  return p("loth-melody-rubric", m.note);
}

/** Same as `htmlMelodyRubric`; named so scored call sites stay explicit. */
export function htmlScoredMelodyRubric(m?: { note?: string }): LothElement | null {
  return htmlMelodyRubric(m);
}

/** The psalm-tone label, and the tone's score under it. */
export function htmlPsalmToneBlock(repo: DataRepository, scoreLine: MaybeNode): LothNode | null {
  if (!scoreLine) return null;
  const label = getLabels(repo).rubrics.psalmTone ?? "Psalm tone";
  return fragment([p("loth-psalm-tone-label", label), scoreLine], "\n");
}

export function htmlHymn(hymn: Hymn): LothElement | null {
  const stanzas = [...hymn.stanzas, hymn.doxology]
    .map((s) => prose("loth-hymn-stanza", s));
  return wrap("div", "loth-hymn", ...stanzas);
}

export function htmlShortReading(r: { reference: string; text: string }): LothElement | null {
  return wrap(
    "section",
    "loth-short-reading",
    p("loth-reference", r.reference),
    prose("loth-reading-text", r.text),
  );
}

export function htmlShortResponsory(repo: DataRepository, r: ShortResponsory): LothElement | null {
  const { responseSymbol, versicleSymbol } = getLabels(repo).rubrics;
  return wrap(
    "div",
    "loth-responsory",
    rubricLine("loth-response", responseSymbol, r.text),
    rubricLine("loth-versicle", versicleSymbol, r.versicle),
    rubricLine("loth-response", responseSymbol, r.text),
  );
}

/**
 * Render a plain versicle/response dialogue block (symbol-prefixed lines) into
 * `loth-versicle`/`loth-response` paragraphs; lines without a known symbol pass
 * through as plain text (e.g. the multi-line Gloria of the introductory verse).
 */
export function htmlDialogueLines(repo: DataRepository, plain: string): LothElement | null {
  const labels = getLabels(repo).rubrics;
  const lines = plain
    .split("\n")
    .map((line) => {
      if (line.startsWith(`${labels.versicleSymbol} `)) {
        return rubricLine("loth-versicle", labels.versicleSymbol, line.slice(labels.versicleSymbol.length + 1));
      }
      if (line.startsWith(`${labels.responseSymbol} `)) {
        return rubricLine("loth-response", labels.responseSymbol, line.slice(labels.responseSymbol.length + 1));
      }
      return p("loth-dialogue-line", line);
    });
  return wrap("div", "loth-dialogue", ...lines);
}

export function htmlIntroductoryVerse(
  repo: DataRepository,
  flags: LiturgicalFlags,
): LothElement | null {
  return htmlDialogueLines(repo, formatIntroductoryVersePlain(repo, flags));
}

export function htmlInvitatoryVerse(repo: DataRepository): LothElement | null {
  return htmlDialogueLines(repo, formatInvitatoryVersePlain(repo));
}

/**
 * The OoR closing acclamation is an opaque raw data string (its own ℣./℟.
 * glyphs baked in), so emit it as plain paragraphs rather than parsing it into
 * dialogue markup — matching PlainTextAssembler, which treats it as raw text.
 */
export function htmlOorAcclamation(repo: DataRepository): LothElement | null {
  const lines = formatOorAcclamationPlain(repo)
    .split("\n")
    .map((line) => p("loth-dialogue-line", line));
  return wrap("div", "loth-dialogue", ...lines);
}

/** Standalone versicle/response (OoR before readings, Daytime after reading). */
export function htmlVersicle(repo: DataRepository, v: Versicle): LothElement | null {
  return htmlDialogueLines(
    repo,
    `${formatVersicleLinePlain(repo, v.verse)}\n${formatResponseLinePlain(repo, v.response)}`,
  );
}

/** Long responsory (OoR): same R/V/R shape as the short responsory markup. */
export function htmlLongResponsory(repo: DataRepository, r: LongResponsory): LothElement | null {
  const { responseSymbol, versicleSymbol } = getLabels(repo).rubrics;
  return wrap(
    "div",
    "loth-responsory",
    rubricLine("loth-response", responseSymbol, r.text),
    rubricLine("loth-versicle", versicleSymbol, r.verse),
    rubricLine("loth-response", responseSymbol, r.repeatCue),
  );
}

/** Long biblical/patristic/hagiographical reading: attribution then body. */
export function htmlReading(attribution: string, body: string): LothElement | null {
  return wrap(
    "section",
    "loth-reading",
    p("loth-reference", attribution),
    prose("loth-reading-text", body),
  );
}

export function htmlTeDeum(repo: DataRepository): LothElement | null {
  return wrap("section", "loth-te-deum", prose("loth-prose", formatTeDeumPlain(repo)));
}

export function htmlExaminationOfConscience(repo: DataRepository): LothElement | null {
  return wrap(
    "section",
    "loth-examination",
    prose("loth-prose", formatExaminationOfConsciencePlain(repo)),
  );
}

export function htmlComplineBlessing(repo: DataRepository): LothElement | null {
  return wrap(
    "section",
    "loth-compline-blessing",
    prose("loth-prose", formatComplineBlessingPlain(repo)),
  );
}

export function htmlGospelCanticle(
  repo: DataRepository,
  kind: GospelCanticleKind,
): LothElement | null {
  const canticle = repo.getGospelCanticle(kind);
  if (!canticle) {
    return wrap(
      "section",
      "loth-gospel-canticle",
      prose("loth-prose", "[Gospel canticle — text not loaded]"),
    );
  }
  return wrap(
    "section",
    "loth-gospel-canticle",
    p("loth-reference", canticle.reference),
    prose("loth-prose", canticle.text),
  );
}

export function htmlLordsPrayerSection(repo: DataRepository): LothElement | null {
  const plain = formatLordsPrayerPlain(repo);
  const [, ...bodyParts] = plain.split("\n\n");
  const title = getLabels(repo).sections.ourFather;
  const body = bodyParts.join("\n\n");
  return wrap(
    "section",
    "loth-lords-prayer",
    el("h2", { class: "loth-section-heading" }, text(title)),
    prose("loth-prose", body),
  );
}

export function htmlConcludingPrayer(
  repo: DataRepository,
  body: string,
  hour: HourLabelKey | "firstVespers",
): LothElement | null {
  const prayer = prose("loth-prose", body);
  if (!includesLetUsPrayRubric(hour)) {
    return wrap("section", "loth-concluding-prayer", prayer);
  }
  const rubric = p("loth-let-us-pray", getLabels(repo).rubrics.letUsPray);
  return wrap("section", "loth-concluding-prayer", rubric, prayer);
}

export function htmlDismissal(repo: DataRepository): LothElement | null {
  return wrap(
    "section",
    "loth-dismissal",
    prose("loth-prose", formatDismissalPlain(repo)),
  );
}

export function htmlIntercessions(repo: DataRepository, i: Intercessions): LothNode | null {
  const { responseSymbol, versicleSymbol } = getLabels(repo).rubrics;
  const body = wrap(
    "div",
    "loth-intercessions",
    p("loth-intercessions-intro", i.introduction),
    rubricLine("loth-intercessions-response", responseSymbol, i.response),
    ...i.intentions.map((int) =>
      wrap(
        "div",
        "loth-intention",
        rubricLine("loth-versicle", versicleSymbol, int.firstPart),
        rubricLine("loth-response", responseSymbol, int.secondPart),
      ),
    ),
  );
  return fragment([htmlSectionHeading(repo, "intercessions"), body], "\n");
}

/** Psalm body: one paragraph per verse, so verses can be styled individually. */
export function htmlPsalmText(body: string): LothElement | null {
  const verses = body
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => p("loth-psalm-verse", line));
  return wrap("div", "loth-psalm", ...verses);
}

/** Plain prose with no liturgical role of its own (memoria addendum prayers). */
export function htmlPlainProse(body: string): LothNode | null {
  return prose("loth-prose", body);
}

// ---------------------------------------------------------------------------
// Document wrapping
// ---------------------------------------------------------------------------

/** One hour, as a fragment a host can insert into an existing page. */
export function htmlHourFragment(hourKey: string, body: MaybeNode): LothElement | null {
  return block("article", { class: "loth-hour", "data-hour": hourKey }, body);
}

export interface LothHtmlDocumentOptions {
  /** `<title>`; defaults to the first hour heading found in the body. */
  title?: string;
  /** Stylesheet URL. */
  cssHref?: string;
  /** URL the import map binds `@vagdur/exsurge` to. */
  exsurgeUrl?: string;
  /** URL of the compiled browser runtime (`dist/browser/lothChant.js`). */
  runtimeUrl?: string;
  /** Extra markup injected just inside `<body>`, before the hours. */
  headerHtml?: string;
  /** Extra markup injected at the end of `<body>` (e.g. host controls). */
  footerHtml?: string;
  /**
   * Emit the bootstrap script that renders the scores. Default true. Set false
   * when the page renders them itself — e.g. to keep the handles and drive its
   * own controls. The import map is emitted either way, since the runtime keeps
   * its bare `@vagdur/exsurge` specifier however it is loaded.
   */
  mountScores?: boolean;
  /** Emit the import map. Default true; set false when a bundler resolves. */
  importMap?: boolean;
  /** Language tag for `<html lang>`. */
  lang?: string;
  /**
   * The specs the bootstrap renders, carried in the page as JSON.
   *
   * The runtime does not search the document for scores, so a standalone page
   * has to say what its scores are rather than leaving them to be discovered.
   */
  scores?: readonly ScoreSpec[];
}

const DEFAULT_DOCUMENT_OPTIONS = {
  cssHref: "loth.css",
  exsurgeUrl: "./exsurge.mjs",
  runtimeUrl: "./lothChant.js",
} as const;

/**
 * Wrap hour fragments in a standalone page — the counterpart of
 * `wrapLothDocument`. The import map is what lets the runtime keep its bare
 * `@vagdur/exsurge` specifier in a plain browser, with no bundler.
 */
export function wrapLothHtmlDocument(
  repo: DataRepository,
  body: string,
  options?: LothHtmlDocumentOptions,
): string {
  const cssHref = options?.cssHref ?? DEFAULT_DOCUMENT_OPTIONS.cssHref;
  const exsurgeUrl = options?.exsurgeUrl ?? DEFAULT_DOCUMENT_OPTIONS.exsurgeUrl;
  const runtimeUrl = options?.runtimeUrl ?? DEFAULT_DOCUMENT_OPTIONS.runtimeUrl;
  const lang = options?.lang ?? repo.locale;
  const title = options?.title ?? "Liturgia Horarum";

  const importMap = options?.importMap === false
    ? ""
    : `<script type="importmap">
{"imports": {"@vagdur/exsurge": "${escapeHtmlAttr(exsurgeUrl)}"}}
</script>
`;

  // The page carries its scores as data, whether or not it uses the bootstrap
  // below: a host supplying its own script still needs to know what to render,
  // and the runtime will not go looking. `</script>` inside JSON would end the
  // block early, so the solidus is escaped — still valid JSON either way.
  const specs = JSON.stringify(options?.scores ?? []).replaceAll("/", "\\/");
  const scoreData = `<script type="application/json" id="loth-scores">${specs}</script>
`;

  const bootstrap = options?.mountScores === false
    ? ""
    : `<script type="module">
import { renderScore } from "${escapeHtmlAttr(runtimeUrl)}";
for (const spec of JSON.parse(document.getElementById("loth-scores").textContent)) {
  // The selector is built rather than written out so that this script does not
  // itself read as a score mount to anything grepping the page for one.
  const el = document.querySelector('[data-score-id=' + JSON.stringify(spec.id) + ']');
  if (el) renderScore(el, spec);
}
</script>
`;

  const header = options?.headerHtml ? `${options.headerHtml}\n` : "";
  const footer = options?.footerHtml ? `${options.footerHtml}\n` : "";

  return `<!doctype html>
<html lang="${escapeHtmlAttr(lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtmlText(title)}</title>
<link rel="stylesheet" href="${escapeHtmlAttr(cssHref)}">
${importMap}${scoreData}${bootstrap}</head>
<body>
${header}${body}
${footer}</body>
</html>
`;
}
