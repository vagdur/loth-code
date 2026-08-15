/**
 * Browser runtime — turns a `ScoreSpec` into rendered, playable chant.
 *
 * This is the only DOM-touching code in the package. A host gives it an element
 * it owns and a spec from the assembled tree; it returns a handle that owns
 * everything it created.
 *
 * It deliberately does **not** search the document. The previous version took a
 * root and scanned it for `[data-loth-score]`, which meant teardown had to scan
 * again and hope the DOM was as it had been left — false under any framework
 * that owns its own elements, so players and their resize listeners were never
 * released. Passing the spec in and handing a handle back removes the question:
 * `destroy()` closes over exactly what it made, and works on an element that
 * has already been detached.
 *
 * The player has no interface of its own — clicking a note plays from there,
 * clicking again stops. Hosts build their own controls on `setPlayback` or on
 * the `ChantPlayer` from `ready`. Browsers only start audio inside a user
 * gesture: clicking a note satisfies that by itself, but a host-built play
 * button must call `player.unlock()` from its own click handler first.
 */

import * as exsurge from "@vagdur/exsurge";
import { withGabcHeader } from "../assemblers/gabcHeader.js";
import type { ScoreSpec } from "../assemblers/tree.js";

export type { ScoreSpec };

export interface RenderOptions {
  /**
   * exsurge player options, forwarded verbatim: `speed`, `tuning`,
   * `transpose`, `instrument`, `volume`, `loop`, `onNoteChange`, …
   */
  player?: Partial<exsurge.ChantPlayerOptions>;
  /** Re-run line breaking when the container width changes. Default true. */
  autoResize?: boolean;
  /**
   * Render the first letter as a drop cap, spanning staff and lyrics, as
   * Gregorio does. Defaults to on except for psalm tones (no lyrics to take
   * an initial from).
   */
  useDropCap?: boolean;
  /** Used when the spec carries no language of its own. */
  language?: ScoreSpec["language"];
  /**
   * A single line printed above the drop cap — `℣`, `Ant.`, a mode number —
   * as Gregorio prints one.
   *
   * It has to be an option rather than something the gabc carries: exsurge's
   * parser strips the header, so a `mode:` or `annotation:` field in the
   * source never reaches the score. Gregorio places `mode:` above the initial
   * automatically; exsurge does not (yet).
   */
  annotation?: string;
  /**
   * Prefix for the `id` exsurge puts on each note element.
   *
   * Defaults to one derived from the score id, because exsurge's own default
   * is the constant `"note-"` and every score gets its own `ChantContext` —
   * so a page showing an hour would otherwise carry twenty-odd elements all
   * called `note-1`. Playback is unaffected either way (the player matches on
   * `element-index`, scoped to its own roots), but duplicate ids make the
   * document invalid and anything addressing a note by id ambiguous.
   */
  noteIdPrefix?: string;
  /**
   * Called when layout fails. Wired to exsurge's `onError` (vagdur/exsurge#13);
   * also stamps `data-loth-score-error` and rejects `ready`.
   */
  onError?: (error: Error, element: HTMLElement) => void;
}

/** A rendered score. Everything the host needs, and nothing it must look up. */
export interface ScoreHandle {
  readonly id: string;
  /** The element the score was rendered into. */
  readonly element: HTMLElement;
  /** Resolves once exsurge has laid the score out and wired up playback. */
  readonly ready: Promise<exsurge.ChantPlayer>;
  /** The player, once ready; null until then, and if layout failed. */
  readonly player: exsurge.ChantPlayer | null;
  /**
   * Volume, tempo, key. Safe to call at any time — before `ready` the settings
   * are held and handed to the player when it arrives, so a host never has to
   * sequence its controls against layout.
   */
  setPlayback(options: Partial<exsurge.ChantPlayerOptions>): void;
  /**
   * Release the player, its audio resources and its resize listener, and empty
   * the element. Idempotent, and safe once the element is detached.
   */
  destroy(): void;
}

/** Map Gregorio language headers to exsurge syllabification languages. */
function exsurgeLanguage(
  code: ScoreSpec["language"],
): (typeof exsurge.language)[keyof typeof exsurge.language] {
  if (code === "latin") return exsurge.language.latin;
  return exsurge.language.swedish;
}

/**
 * A score built here rather than by exsurge, so its annotation is in place
 * before layout runs.
 *
 * This is the one thing `createPlayableChant` cannot be told: it constructs the
 * `ChantScore` from the gabc itself, and `annotation` is read during layout, so
 * the score handed to `onReady` is already too late to set it on. exsurge takes
 * a prebuilt score for exactly this (vagdur/exsurge#15) — construction is the
 * two lines it would have run anyway, and everything after it is still theirs.
 */
function annotatedScore(
  ctxt: exsurge.ChantContext,
  source: string,
  annotation: string,
  useDropCap: boolean,
): exsurge.ChantScore {
  const score = new exsurge.ChantScore(
    ctxt,
    exsurge.Gabc.createMappingsFromSource(ctxt, source),
    useDropCap,
  );
  score.annotation = new exsurge.Annotation(ctxt, annotation);
  return score;
}

/**
 * Render one score into `element`.
 *
 * Returns synchronously — the element is claimed immediately, while exsurge
 * lays out asynchronously. Await `handle.ready` for the player.
 */
export function renderScore(
  element: HTMLElement,
  spec: ScoreSpec,
  options?: RenderOptions,
): ScoreHandle {
  // Hand-written specs may carry a bare notation body; the assembler's own
  // always arrive with a header, and withGabcHeader leaves those alone.
  const source = withGabcHeader(spec.gabc.trim(), spec.id);

  let resolveReady!: (player: exsurge.ChantPlayer) => void;
  let rejectReady!: (error: Error) => void;
  const ready = new Promise<exsurge.ChantPlayer>((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });
  // Nothing may await `ready`; a rejection must not surface as an unhandled one.
  void ready.catch(() => undefined);

  let player: exsurge.ChantPlayer | null = null;
  let pending: Partial<exsurge.ChantPlayerOptions> | null = options?.player ?? null;
  let destroyed = false;

  const fail = (cause: unknown): void => {
    if (destroyed) return;
    const error = cause instanceof Error ? cause : new Error(String(cause));
    element.dataset["lothScoreError"] = error.message;
    rejectReady(error);
    options?.onError?.(error, element);
  };

  const handle: ScoreHandle = {
    id: spec.id,
    element,
    ready,
    get player() {
      return player;
    },
    setPlayback(next) {
      if (destroyed) return;
      if (player) player.setOptions(next);
      else pending = { ...pending, ...next };
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      // Also removes the window resize listener createPlayableChant installed.
      player?.destroy();
      player = null;
      element.replaceChildren();
    },
  };

  // One ChantContext per score: parsing mutates ctxt.activeClef and layout is
  // async, so scores must not share one.
  const ctxt = new exsurge.ChantContext();
  ctxt.defaultLanguage = exsurgeLanguage(spec.language ?? options?.language);
  ctxt.noteIdPrefix = options?.noteIdPrefix ?? `note-${spec.id}-`;

  // Gregorio's default (and the PDF path): a drop cap on lyric scores, none
  // on psalm tones. Hosts can still force either way.
  const useDropCap = options?.useDropCap ?? !spec.psalmTone;

  try {
    exsurge.createPlayableChant(
      ctxt,
      options?.annotation
        ? annotatedScore(ctxt, source, options.annotation, useDropCap)
        : source,
      element,
      {
        ...(pending ?? {}),
        // Explicit after the spread: these have dedicated options. useDropCap
        // is ignored when the second argument is a prebuilt score, which is
        // why annotatedScore takes it too.
        autoResize: options?.autoResize ?? true,
        useDropCap,
        // Layout failures used to hang silently; exsurge now reports them here
        // (vagdur/exsurge#13). Reject ready and stamp data-loth-score-error.
        onError: (error) => {
          fail(error);
        },
      },
      (ready_) => {
        // Destroyed while laying out: the element is no longer ours, so let go
        // of what exsurge just built rather than leaving it running.
        if (destroyed) {
          ready_.destroy();
          return;
        }
        player = ready_;
        // Re-applies host player options, including a host-supplied onError for
        // subsequent playback failures (layout already went through ours above).
        if (pending) player.setOptions(pending);
        pending = null;
        resolveReady(player);
      },
    );
  } catch (cause) {
    fail(cause);
  }

  return handle;
}
