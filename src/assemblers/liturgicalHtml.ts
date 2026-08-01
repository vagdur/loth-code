/**
 * Semantic HTML markup — role-based class names only; formatting lives in
 * html/loth.css. The direct counterpart of liturgicalTex.ts, element for
 * element, so the HTML and LaTeX renderers stay slot-for-slot comparable.
 *
 * One divergence from the LaTeX side: rubric strings (`Ant.`, `℣.`, `℟.`,
 * `Let us pray.`, the psalm-tone label) are baked straight into the markup.
 * TeX needs `\LothRubrics*` configuration macros because macros are late-bound;
 * HTML output is final, so there is no counterpart to `emitLothRubrics`.
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

// ---------------------------------------------------------------------------
// Low-level builders
// ---------------------------------------------------------------------------

/** One `<p class="…">escaped text</p>`. */
function p(className: string, text: string): string {
  return `<p class="${className}">${escapeHtmlText(text)}</p>`;
}

/**
 * Render a plain-text block as paragraphs: blank lines separate `<p>`s, single
 * newlines become `<br>` inside one. This is what LaTeX does with the same
 * string, so both renderers break the text in the same places.
 */
function prose(className: string, text: string): string {
  return text
    .split(/\n{2,}/)
    .map((para) => para.split("\n").map(escapeHtmlText).join("<br>"))
    .filter((para) => para.length > 0)
    .map((para) => `<p class="${className}">${para}</p>`)
    .join("\n");
}

/** A rubric symbol (`℣.`, `Ant.`, …) followed by its line of text. */
function rubricLine(className: string, symbol: string, text: string): string {
  return `<p class="${className}"><span class="loth-rubric">${escapeHtmlText(symbol)}</span> ${escapeHtmlText(text)}</p>`;
}

function wrap(tag: string, className: string, inner: string): string {
  if (!inner) return "";
  return `<${tag} class="${className}">\n${indent(inner)}\n</${tag}>`;
}

function indent(block: string): string {
  return block
    .split("\n")
    .map((line) => (line ? `  ${line}` : line))
    .join("\n");
}

// ---------------------------------------------------------------------------
// Elements (one per liturgicalTex.ts macro)
// ---------------------------------------------------------------------------

export function htmlHourHeading(
  repo: DataRepository,
  key: HourLabelKey,
  liturgicalDay?: LiturgicalDay,
  calendarId = "general",
): string {
  const hour = getLabels(repo).hours[key];
  const ordoLabels = repo.getAssemblerLabels().ordo;
  const title = liturgicalDay && ordoLabels
    ? `${hour} - ${formatOrdoDayHeadline(liturgicalDay, ordoLabels, calendarId)}`
    : hour;
  return `<h1 class="loth-hour-heading">${escapeHtmlText(title)}</h1>`;
}

export function htmlSectionHeading(repo: DataRepository, key: SectionLabelKey): string {
  return `<h2 class="loth-section-heading">${escapeHtmlText(getLabels(repo).sections[key])}</h2>`;
}

export function htmlAntiphon(
  repo: DataRepository,
  a: Antiphon,
  flags: LiturgicalFlags,
): string {
  const alleluia = alleluiaAntiphonSuffix(repo, flags, a.suppressAlleluia);
  return rubricLine("loth-antiphon", getLabels(repo).rubrics.antiphonPrefix, a.text + alleluia);
}

export function htmlMelodyRubric(m?: { mode?: number; note?: string }): string {
  if (!m) return "";
  const parts: string[] = [];
  if (m.mode !== undefined) parts.push(`Mode ${m.mode}`);
  if (m.note) parts.push(m.note);
  if (parts.length === 0) return "";
  return p("loth-melody-rubric", parts.join(" — "));
}

export function htmlPsalmToneBlock(repo: DataRepository, scoreLine: string): string {
  if (!scoreLine) return "";
  const label = getLabels(repo).rubrics.psalmTone ?? "Psalm tone";
  return `${p("loth-psalm-tone-label", label)}\n${scoreLine}`;
}

export function htmlHymn(hymn: Hymn): string {
  const stanzas = [...hymn.stanzas, hymn.doxology]
    .map((s) => prose("loth-hymn-stanza", s))
    .filter((s) => s)
    .join("\n");
  return wrap("div", "loth-hymn", stanzas);
}

export function htmlShortReading(r: { reference: string; text: string }): string {
  return wrap(
    "section",
    "loth-short-reading",
    `${p("loth-reference", r.reference)}\n${prose("loth-reading-text", r.text)}`,
  );
}

export function htmlShortResponsory(repo: DataRepository, r: ShortResponsory): string {
  const { responseSymbol, versicleSymbol } = getLabels(repo).rubrics;
  return wrap("div", "loth-responsory", [
    rubricLine("loth-response", responseSymbol, r.text),
    rubricLine("loth-versicle", versicleSymbol, r.versicle),
    rubricLine("loth-response", responseSymbol, r.text),
  ].join("\n"));
}

/**
 * Render a plain versicle/response dialogue block (symbol-prefixed lines) into
 * `loth-versicle`/`loth-response` paragraphs; lines without a known symbol pass
 * through as plain text (e.g. the multi-line Gloria of the introductory verse).
 */
export function htmlDialogueLines(repo: DataRepository, plain: string): string {
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
    })
    .join("\n");
  return wrap("div", "loth-dialogue", lines);
}

export function htmlIntroductoryVerse(
  repo: DataRepository,
  flags: LiturgicalFlags,
): string {
  return htmlDialogueLines(repo, formatIntroductoryVersePlain(repo, flags));
}

export function htmlInvitatoryVerse(repo: DataRepository): string {
  return htmlDialogueLines(repo, formatInvitatoryVersePlain(repo));
}

/**
 * The OoR closing acclamation is an opaque raw data string (its own ℣./℟.
 * glyphs baked in), so emit it as plain paragraphs rather than parsing it into
 * dialogue markup — matching PlainTextAssembler, which treats it as raw text.
 */
export function htmlOorAcclamation(repo: DataRepository): string {
  const lines = formatOorAcclamationPlain(repo)
    .split("\n")
    .map((line) => p("loth-dialogue-line", line))
    .join("\n");
  return wrap("div", "loth-dialogue", lines);
}

/** Standalone versicle/response (OoR before readings, Daytime after reading). */
export function htmlVersicle(repo: DataRepository, v: Versicle): string {
  return htmlDialogueLines(
    repo,
    `${formatVersicleLinePlain(repo, v.verse)}\n${formatResponseLinePlain(repo, v.response)}`,
  );
}

/** Long responsory (OoR): same R/V/R shape as the short responsory markup. */
export function htmlLongResponsory(repo: DataRepository, r: LongResponsory): string {
  const { responseSymbol, versicleSymbol } = getLabels(repo).rubrics;
  return wrap("div", "loth-responsory", [
    rubricLine("loth-response", responseSymbol, r.text),
    rubricLine("loth-versicle", versicleSymbol, r.verse),
    rubricLine("loth-response", responseSymbol, r.repeatCue),
  ].join("\n"));
}

/** Long biblical/patristic/hagiographical reading: attribution then body. */
export function htmlReading(attribution: string, text: string): string {
  return wrap(
    "section",
    "loth-reading",
    `${p("loth-reference", attribution)}\n${prose("loth-reading-text", text)}`,
  );
}

export function htmlTeDeum(repo: DataRepository): string {
  return wrap("section", "loth-te-deum", prose("loth-prose", formatTeDeumPlain(repo)));
}

export function htmlExaminationOfConscience(repo: DataRepository): string {
  return wrap(
    "section",
    "loth-examination",
    prose("loth-prose", formatExaminationOfConsciencePlain(repo)),
  );
}

export function htmlComplineBlessing(repo: DataRepository): string {
  return wrap(
    "section",
    "loth-compline-blessing",
    prose("loth-prose", formatComplineBlessingPlain(repo)),
  );
}

export function htmlGospelCanticle(
  repo: DataRepository,
  kind: GospelCanticleKind,
): string {
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
    `${p("loth-reference", canticle.reference)}\n${prose("loth-prose", canticle.text)}`,
  );
}

export function htmlLordsPrayerSection(repo: DataRepository): string {
  const plain = formatLordsPrayerPlain(repo);
  const [, ...bodyParts] = plain.split("\n\n");
  const title = getLabels(repo).sections.ourFather;
  const body = bodyParts.join("\n\n");
  return wrap(
    "section",
    "loth-lords-prayer",
    `<h2 class="loth-section-heading">${escapeHtmlText(title)}</h2>\n${prose("loth-prose", body)}`,
  );
}

export function htmlConcludingPrayer(
  repo: DataRepository,
  text: string,
  hour: HourLabelKey | "firstVespers",
): string {
  const body = prose("loth-prose", text);
  if (!includesLetUsPrayRubric(hour)) {
    return wrap("section", "loth-concluding-prayer", body);
  }
  const rubric = p("loth-let-us-pray", getLabels(repo).rubrics.letUsPray);
  return wrap("section", "loth-concluding-prayer", `${rubric}\n${body}`);
}

export function htmlDismissal(repo: DataRepository): string {
  return wrap(
    "section",
    "loth-dismissal",
    prose("loth-prose", formatDismissalPlain(repo)),
  );
}

export function htmlIntercessions(repo: DataRepository, i: Intercessions): string {
  const { responseSymbol, versicleSymbol } = getLabels(repo).rubrics;
  const inner = [
    p("loth-intercessions-intro", i.introduction),
    rubricLine("loth-intercessions-response", responseSymbol, i.response),
    ...i.intentions.map((int) =>
      wrap("div", "loth-intention", [
        rubricLine("loth-versicle", versicleSymbol, int.firstPart),
        rubricLine("loth-response", responseSymbol, int.secondPart),
      ].join("\n")),
    ),
  ].join("\n");
  return `${htmlSectionHeading(repo, "intercessions")}\n${wrap("div", "loth-intercessions", inner)}`;
}

/** Psalm body: one paragraph per verse, so verses can be styled individually. */
export function htmlPsalmText(text: string): string {
  const verses = text
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => p("loth-psalm-verse", line))
    .join("\n");
  return wrap("div", "loth-psalm", verses);
}

/** Plain prose with no liturgical role of its own (memoria addendum prayers). */
export function htmlPlainProse(text: string): string {
  return prose("loth-prose", text);
}

// ---------------------------------------------------------------------------
// Scores
// ---------------------------------------------------------------------------

/**
 * A mount point for one chant score. The GABC travels inline in `data-gabc`
 * (unlike the LaTeX path, which writes sibling `.gabc` files), so a page is
 * self-contained; `mountScores` in src/browser/lothChant.ts finds these by
 * `[data-loth-score]` and hands each to exsurge.
 */
export function htmlScoreLine(
  id: string,
  gabc: string,
  extraClass = "",
  language?: "svenska" | "latin",
  /** Store melody id (`kln/...`) when the score came from the melody store. */
  melodyId?: string,
): string {
  const cls = extraClass ? `loth-score ${extraClass}` : "loth-score";
  const langAttr = language
    ? ` data-language="${escapeHtmlAttr(language)}"`
    : "";
  const melodyAttr = melodyId
    ? ` data-melody-id="${escapeHtmlAttr(melodyId)}"`
    : "";
  return `<div class="${cls}" data-loth-score data-score-id="${escapeHtmlAttr(id)}" data-gabc="${escapeHtmlAttr(gabc)}"${langAttr}${melodyAttr}></div>`;
}

export function htmlPsalmToneScoreLine(
  id: string,
  gabc: string,
  language?: "svenska" | "latin",
  melodyId?: string,
): string {
  return htmlScoreLine(id, gabc, "loth-psalm-tone", language, melodyId);
}

// ---------------------------------------------------------------------------
// Document wrapping
// ---------------------------------------------------------------------------

/** One hour, as a fragment a host can insert into an existing page. */
export function htmlHourFragment(hourKey: string, body: string): string {
  return `<article class="loth-hour" data-hour="${escapeHtmlAttr(hourKey)}">\n${indent(body)}\n</article>`;
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
   * Emit the bootstrap script that mounts the scores. Default true. Set false
   * when the page mounts them itself — e.g. to keep the handles and drive its
   * own controls. The import map is emitted either way, since the runtime keeps
   * its bare `@vagdur/exsurge` specifier however it is loaded.
   */
  mountScores?: boolean;
  /** Emit the import map. Default true; set false when a bundler resolves. */
  importMap?: boolean;
  /** Language tag for `<html lang>`. */
  lang?: string;
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

  const bootstrap = options?.mountScores === false
    ? ""
    : `<script type="module">
import { mountScores } from "${escapeHtmlAttr(runtimeUrl)}";
mountScores(document);
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
${importMap}${bootstrap}</head>
<body>
${header}${body}
${footer}</body>
</html>
`;
}
