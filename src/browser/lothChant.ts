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

/**
 * How long layout may take before we call it failed.
 *
 * exsurge lays out across `setTimeout` chunks, so a throw inside one is not
 * catchable from here and simply means the completion callback never fires. It
 * also retries indefinitely, every 100ms, when it cannot get a sane text
 * measurement. Both look the same from outside — a permanently empty element
 * and no error anywhere — which is precisely how a blank score stayed invisible
 * before. A watchdog turns either into a rejected `ready` and a
 * `data-loth-score-error` attribute the stylesheet already knows how to show.
 */
const LAYOUT_TIMEOUT_MS = 15_000;

export interface RenderOptions {
  /**
   * exsurge player options, forwarded verbatim: `speed`, `tuning`,
   * `transpose`, `instrument`, `volume`, `loop`, `onNoteChange`, …
   */
  player?: Partial<exsurge.ChantPlayerOptions>;
  /** Re-run line breaking when the container width changes. Default true. */
  autoResize?: boolean;
  /** Render the first letter as a drop cap. Default false. */
  useDropCap?: boolean;
  /** Used when the spec carries no language of its own. */
  language?: ScoreSpec["language"];
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
  /** Called when this score fails to lay out. */
  onError?: (error: Error, element: HTMLElement) => void;
  /** Override the layout watchdog. Chiefly for tests. */
  layoutTimeoutMs?: number;
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
  let watchdog: ReturnType<typeof setTimeout> | undefined;

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
      if (watchdog !== undefined) clearTimeout(watchdog);
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
  // Real at runtime (Exsurge.Drawing.js sets it in the constructor) but absent
  // from exsurge's declarations — see vagdur/exsurge#15.
  (ctxt as exsurge.ChantContext & { noteIdPrefix: string }).noteIdPrefix =
    options?.noteIdPrefix ?? `note-${spec.id}-`;

  watchdog = setTimeout(() => {
    watchdog = undefined;
    fail(new Error(`exsurge did not finish laying out "${spec.id}" in time`));
  }, options?.layoutTimeoutMs ?? LAYOUT_TIMEOUT_MS);

  try {
    exsurge.createPlayableChant(
      ctxt,
      source,
      element,
      {
        ...(pending ?? {}),
        // Explicit after the spread: these have dedicated options, and exsurge
        // defaults useDropCap to true, which suits a book opening rather than
        // the score fragments an hour is made of.
        autoResize: options?.autoResize ?? true,
        useDropCap: options?.useDropCap ?? false,
      },
      (ready_) => {
        if (watchdog !== undefined) {
          clearTimeout(watchdog);
          watchdog = undefined;
        }
        // Destroyed while laying out: the element is no longer ours, so let go
        // of what exsurge just built rather than leaving it running.
        if (destroyed) {
          ready_.destroy();
          return;
        }
        player = ready_;
        if (pending) player.setOptions(pending);
        pending = null;
        resolveReady(player);
      },
    );
  } catch (cause) {
    if (watchdog !== undefined) {
      clearTimeout(watchdog);
      watchdog = undefined;
    }
    fail(cause);
  }

  return handle;
}
