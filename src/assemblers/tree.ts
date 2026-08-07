/**
 * The document tree an HtmlAssembler produces, and the one place that knows how
 * it becomes HTML.
 *
 * The assembler used to build strings directly, which made a score mount an
 * opaque `<div data-gabc="…">` buried in markup: the only way to find one was
 * to scan the live DOM for it, and the only way to put an hour on a page was to
 * assign `innerHTML`. That is fine for a static page and hostile to anything
 * that owns its own DOM — a React host must hand the string to
 * `dangerouslySetInnerHTML`, and React 19 rewrites that property on every
 * re-render, throwing away whatever the chant renderer had drawn underneath.
 *
 * So scores are a node kind rather than a shape of markup. A host that renders
 * the tree itself gets each score as data, mounts it in an element it owns, and
 * never has to parse or re-scan anything. `renderHtml` keeps the string output
 * for the static path, byte for byte.
 */

import type { ChantLanguage } from "../types/melody.js";
import { escapeHtmlAttr, escapeHtmlText } from "./htmlEscape.js";

/** One chant score: everything a renderer needs, with no markup around it. */
export interface ScoreSpec {
  /** Per-hour id, e.g. `lauds-score-1`. Matches TexAssembler's numbering. */
  readonly id: string;
  /** GABC, already through `withGabcHeader`. */
  readonly gabc: string;
  readonly language?: ChantLanguage;
  /** Store melody id (`kln/...`) when the score came from the melody store. */
  readonly melodyId?: string;
  /** A psalm tone rather than a melody; styled apart, and labelled above. */
  readonly psalmTone?: boolean;
}

export interface LothText {
  readonly kind: "text";
  /** Unescaped. Escaping happens once, in `renderHtml`. */
  readonly text: string;
}

export interface LothElement {
  readonly kind: "element";
  readonly tag: string;
  readonly props: Readonly<Record<string, string>>;
  readonly children: readonly LothNode[];
  /**
   * Block elements put their children on their own indented lines; inline ones
   * run their children together. This is presentation of the source text only —
   * it exists so `renderHtml` reproduces the hand-written markup exactly.
   */
  readonly block: boolean;
}

/** A list of siblings with no element of its own. */
export interface LothFragment {
  readonly kind: "fragment";
  readonly children: readonly LothNode[];
  readonly separator: string;
}

export interface LothScoreNode {
  readonly kind: "score";
  readonly spec: ScoreSpec;
}

export type LothNode = LothText | LothElement | LothFragment | LothScoreNode;

/** What one `assemble*` call produced. */
export interface AssembledHour {
  /**
   * The hour's body: `<article class="loth-hour">` fragments and nothing
   * around them. A host supplies its own page shell; `html()` supplies LoTH's.
   */
  readonly tree: LothNode;
  /** Every score in the body, in document order. Empty means no chant. */
  readonly scores: readonly ScoreSpec[];
  /**
   * The complete markup — the page shell included, unless the assembler was
   * built with `fragmentOnly`. A method rather than a field because a host that
   * renders the tree never needs it and should not pay to build it.
   */
  html(): string;
}

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

/** Anything a builder may hand back, including "nothing to emit". */
export type MaybeNode = LothNode | null | undefined;

export function text(value: string): LothText {
  return { kind: "text", text: value };
}

/** An element whose children run together on one line: `<p>`, `<span>`, `<h1>`. */
export function el(
  tag: string,
  props: Record<string, string>,
  ...children: MaybeNode[]
): LothElement {
  return { kind: "element", tag, props, children: compact(children), block: false };
}

/**
 * An element whose children each get their own indented line. Returns null when
 * there is nothing to put inside, so callers can drop an empty section the way
 * the string builders used to drop an empty string.
 */
export function block(
  tag: string,
  props: Record<string, string>,
  ...children: MaybeNode[]
): LothElement | null {
  const kept = compact(children);
  if (kept.length === 0) return null;
  return { kind: "element", tag, props, children: kept, block: true };
}

/** Siblings joined by `separator`. Returns null when nothing survives. */
export function fragment(
  children: MaybeNode[],
  separator = "\n",
): LothFragment | null {
  const kept = compact(children);
  if (kept.length === 0) return null;
  return { kind: "fragment", children: kept, separator };
}

export function score(spec: ScoreSpec): LothScoreNode {
  return { kind: "score", spec };
}

function compact(children: readonly MaybeNode[]): LothNode[] {
  return children.filter((child): child is LothNode => child != null);
}

/** Every score in the tree, in document order. */
export function collectScores(node: LothNode): ScoreSpec[] {
  const found: ScoreSpec[] = [];
  walk(node, found);
  return found;
}

function walk(node: LothNode, into: ScoreSpec[]): void {
  switch (node.kind) {
    case "score":
      into.push(node.spec);
      return;
    case "element":
    case "fragment":
      for (const child of node.children) walk(child, into);
      return;
    case "text":
      return;
  }
}

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

/** Elements with no closing tag. */
const VOID_TAGS = new Set(["br", "hr"]);

/**
 * The tree as HTML.
 *
 * Indentation and line breaks are reproduced exactly as the string builders
 * wrote them, because the golden fixtures are the evidence that moving to a
 * tree changed nothing — and `htmlTexParity` matches score attributes by their
 * adjacency, so their order is load-bearing too.
 */
export function renderHtml(node: LothNode): string {
  switch (node.kind) {
    case "text":
      return escapeHtmlText(node.text);

    case "fragment":
      return node.children.map(renderHtml).join(node.separator);

    case "score":
      return renderScoreMount(node.spec);

    case "element": {
      const attrs = Object.entries(node.props)
        .map(([name, value]) => ` ${name}="${escapeHtmlAttr(value)}"`)
        .join("");

      if (VOID_TAGS.has(node.tag)) return `<${node.tag}${attrs}>`;

      const inner = node.children.map(renderHtml).join(node.block ? "\n" : "");
      if (!node.block) return `<${node.tag}${attrs}>${inner}</${node.tag}>`;
      // Matches the old `wrap`: an element with nothing in it emits nothing.
      if (!inner) return "";
      return `<${node.tag}${attrs}>\n${indent(inner)}\n</${node.tag}>`;
    }
  }
}

/**
 * The mount element for one score.
 *
 * Attribute order is fixed: `htmlTexParity` reads ids and GABC back out with a
 * regex that expects `data-score-id` immediately before `data-gabc`.
 */
function renderScoreMount(spec: ScoreSpec): string {
  const cls = spec.psalmTone ? "loth-score loth-psalm-tone" : "loth-score";
  const language = spec.language
    ? ` data-language="${escapeHtmlAttr(spec.language)}"`
    : "";
  const melody = spec.melodyId
    ? ` data-melody-id="${escapeHtmlAttr(spec.melodyId)}"`
    : "";
  return `<div class="${cls}" data-loth-score data-score-id="${escapeHtmlAttr(spec.id)}" data-gabc="${escapeHtmlAttr(spec.gabc)}"${language}${melody}></div>`;
}

function indent(source: string): string {
  return source
    .split("\n")
    .map((line) => (line ? `  ${line}` : line))
    .join("\n");
}
