/**
 * Browser runtime — turns the score mounts an HtmlAssembler page carries into
 * rendered, playable chant.
 *
 * This is the only DOM-touching code in the package, and the whole of what a
 * host needs to add an hour to a page: drop the assembled markup in, link
 * html/loth.css, call `mountScores`.
 *
 * The player deliberately has no interface of its own — clicking a note plays
 * from there, clicking again stops. Hosts build their own controls on the
 * returned `ChantPlayer` handles (`setSpeed`, `setTuning`, `setTranspose`,
 * `setInstrument`, `setVolume`, all safe to call mid-playback). Browsers only
 * start audio inside a user gesture: clicking a note satisfies that by itself,
 * but a host-built play button must call `player.unlock()` from its own click
 * handler first.
 */

import * as exsurge from "@vagdur/exsurge";
import { withGabcHeader } from "../assemblers/gabcHeader.js";
import type { ChantLanguage } from "../types/melody.js";

/** Marks the score mounts emitted by `htmlScoreLine`. */
const SCORE_SELECTOR = "[data-loth-score]";

/** A mounted score and its player. */
export interface LothScore {
  /** The `data-score-id` from the markup (e.g. `lauds-score-1`). */
  readonly id: string;
  readonly element: HTMLElement;
  /** Resolves once exsurge has laid out the score and wired up playback. */
  readonly ready: Promise<exsurge.ChantPlayer>;
  /** The player, once ready; null until then, and if layout failed. */
  player: exsurge.ChantPlayer | null;
}

export interface MountOptions {
  /**
   * exsurge player options, forwarded verbatim: `speed`, `tuning`,
   * `transpose`, `instrument`, `volume`, `loop`, `onNoteChange`, …
   */
  player?: Partial<exsurge.ChantPlayerOptions>;
  /** Re-run line breaking when the container width changes. Default true. */
  autoResize?: boolean;
  /** Render the first letter as a drop cap. Default false. */
  useDropCap?: boolean;
  /**
   * Page-level fallback when a score mount has no `data-language`.
   * Defaults to swedish, the language of the corpus this was written for.
   */
  language?: ChantLanguage;
  /** Called when one score fails to lay out; the rest still mount. */
  onError?: (error: Error, element: HTMLElement) => void;
}

/** Map Gregorio language headers to exsurge syllabification languages. */
function exsurgeLanguage(
  code: string | undefined,
): (typeof exsurge.language)[keyof typeof exsurge.language] {
  if (code === "latin") return exsurge.language.latin;
  if (code === "english") return exsurge.language.english;
  return exsurge.language.swedish;
}

/** Per-element bookkeeping, so `unmountScores` can undo exactly what we did. */
const mounted = new WeakMap<HTMLElement, LothScore>();

/**
 * Render every score under `root` and wire up playback.
 *
 * Returns synchronously — the elements are claimed immediately, while exsurge
 * lays out asynchronously. Await `score.ready` (or
 * `Promise.all(scores.map((s) => s.ready))`) for the players.
 */
export function mountScores(root: ParentNode, options?: MountOptions): LothScore[] {
  const elements = Array.from(root.querySelectorAll<HTMLElement>(SCORE_SELECTOR));
  return elements.map((element) => mountScore(element, options));
}

/** Render one score element. Re-mounting an already-mounted element is a no-op. */
export function mountScore(element: HTMLElement, options?: MountOptions): LothScore {
  const existing = mounted.get(element);
  if (existing) return existing;

  const id = element.dataset["scoreId"] ?? "loth-score";
  const gabc = element.dataset["gabc"] ?? "";
  // Hand-written mounts may carry a bare notation body; the assembler's own
  // always arrive with a header, and withGabcHeader leaves those alone.
  const source = withGabcHeader(gabc.trim(), id);

  let resolveReady!: (player: exsurge.ChantPlayer) => void;
  let rejectReady!: (error: Error) => void;
  const ready = new Promise<exsurge.ChantPlayer>((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });

  const score: LothScore = { id, element, ready, player: null };
  mounted.set(element, score);

  // One ChantContext per score: parsing mutates ctxt.activeClef and layout is
  // async, so scores must not share one.
  const ctxt = new exsurge.ChantContext();
  ctxt.defaultLanguage = exsurgeLanguage(
    element.dataset["language"] ?? options?.language,
  );
  try {
    exsurge.createPlayableChant(
      ctxt,
      source,
      element,
      {
        ...options?.player,
        // Explicit after the spread: these have dedicated options, and exsurge
        // defaults useDropCap to true, which suits a book opening rather than
        // the score fragments an hour is made of.
        autoResize: options?.autoResize ?? true,
        useDropCap: options?.useDropCap ?? false,
      },
      (player) => {
        score.player = player;
        resolveReady(player);
      },
    );
  } catch (cause) {
    const error = cause instanceof Error ? cause : new Error(String(cause));
    element.dataset["lothScoreError"] = error.message;
    rejectReady(error);
    if (options?.onError) options.onError(error, element);
    // Nothing awaits `ready` in the fire-and-forget bootstrap; keep a rejected
    // promise from surfacing as an unhandled rejection there.
    void ready.catch(() => undefined);
  }

  return score;
}

/** Tear down every mounted score under `root`, releasing its audio resources. */
export function unmountScores(root: ParentNode): void {
  for (const element of root.querySelectorAll<HTMLElement>(SCORE_SELECTOR)) {
    unmountScore(element);
  }
}

export function unmountScore(element: HTMLElement): void {
  const score = mounted.get(element);
  if (score) {
    score.player?.destroy();
    score.player = null;
    mounted.delete(element);
  }
  element.replaceChildren();
}

/**
 * Put an assembled hour into a container and mount its scores — the one-call
 * path for a host that already has the markup as a string.
 */
export function renderHour(
  container: HTMLElement,
  html: string,
  options?: MountOptions,
): LothScore[] {
  unmountScores(container);
  container.innerHTML = html;
  return mountScores(container, options);
}
