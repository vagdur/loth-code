/**
 * Every score HtmlAssembler emits must actually render and be playable.
 *
 * exsurge runs its whole pipeline headless — ChantContext falls back to
 * opentype.js when there is no DOM canvas — so this exercises the real browser
 * code path in a plain Node test: parse the GABC, lay it out, produce an SVG
 * tree, and derive the playback timeline. That last step is the point: it
 * proves playback is derivable from the data we ship, not merely that the
 * option is set somewhere.
 *
 * It also guards the inline-GABC transport. exsurge is permissive where
 * Gregorio errored — a dropped paren silently swallows a neume rather than
 * failing — so a parenthesis lint runs alongside the layout.
 */

import * as exsurge from "@vagdur/exsurge";
import { expect, test } from "vitest";
import { HtmlAssembler, type HtmlOutputMode } from "../../src/assemblers/htmlAssembler.js";
import type { AssembledHour } from "../../src/assemblers/tree.js";
import { eveningVespers } from "../../src/hours/index.js";
import {
  buildSampleAbstractDay, loadSampleRepo, SAMPLE_LOCALES,
} from "../helpers/buildSampleDay.js";
import type { DataRepository } from "../../src/data/repository.js";
import type { AbstractDay } from "../../src/types/hours.js";

const HOURS: ReadonlyArray<{
  name: string;
  render: (a: HtmlAssembler, day: AbstractDay, repo: DataRepository) => AssembledHour;
}> = [
  { name: "Office of Readings", render: (a, d, r) => a.assembleOfficeOfReadings(d.officeOfReadings, r) },
  { name: "Lauds", render: (a, d, r) => a.assembleLauds(d.lauds, r) },
  { name: "Vespers", render: (a, d, r) => a.assembleVespers(eveningVespers(d), r) },
  { name: "Compline", render: (a, d, r) => a.assembleCompline(d.compline, r) },
  { name: "Full day", render: (a, d, r) => a.assembleDay(d, r) },
];

const SCORED_MODES: readonly HtmlOutputMode[] = ["hybrid", "scored"];

const matrix = SAMPLE_LOCALES.flatMap((locale) =>
  HOURS.flatMap((hour) => SCORED_MODES.map((mode) => ({ ...hour, locale, mode }))),
);

/** Reverse of escapeHtmlAttr — `&amp;` last, so it cannot re-create an entity. */
function unescapeHtmlAttr(value: string): string {
  return value
    .replaceAll("&#10;", "\n")
    .replaceAll("&#13;", "\r")
    .replaceAll("&#39;", "'")
    .replaceAll("&quot;", '"')
    .replaceAll("&gt;", ">")
    .replaceAll("&lt;", "<")
    .replaceAll("&amp;", "&");
}

/** Pull every score mount out of assembled markup, in document order. */
function extractMounts(html: string): Array<{ id: string; gabc: string }> {
  const re = /data-loth-score data-score-id="([^"]*)" data-gabc="([^"]*)"/g;
  return [...html.matchAll(re)].map((m) => ({
    id: unescapeHtmlAttr(m[1] ?? ""),
    gabc: unescapeHtmlAttr(m[2] ?? ""),
  }));
}

/** Unbalanced parens: exsurge would render on regardless, so check explicitly. */
function parenBalance(gabc: string): string {
  let depth = 0;
  for (const c of gabc) {
    if (c === "(") depth++;
    else if (c === ")" && --depth < 0) return 'unmatched ")"';
  }
  return depth > 0 ? `${depth} unclosed "("` : "";
}

interface RenderResult {
  svgChildren: number;
  playbackEvents: number;
  hasDropCap: boolean;
  annotation: string | undefined;
}

const MODE_ROMAN = ["", "i", "ii", "iii", "iv", "v", "vi", "vii", "viii"];

/** After the header and clef, is the first lyric a letter a drop cap can take? */
function gabcStartsWithLetter(gabc: string): boolean {
  const body = gabc.split(/\n%%\s*\n/)[1] ?? "";
  return /^\([^)]+\)\s*[A-Za-zÀ-ÖØ-öø-ÿ]/.test(body.trim());
}

/** Parse → layout → SVG tree → playback timeline, matching the browser path. */
async function renderHeadless(spec: {
  gabc: string;
  psalmTone?: boolean;
}): Promise<RenderResult> {
  // One context per score: parsing mutates ctxt.activeClef.
  const ctxt = new exsurge.ChantContext();
  const score = exsurge.Gabc.createScoreFromSource(ctxt, spec.gabc, !spec.psalmTone);
  score.performLayout(ctxt);

  const tree = await new Promise<exsurge.SvgTreeNode>((resolve) => {
    score.layoutChantLines(ctxt, 800, () => resolve(score.createSvgTree(ctxt)));
  });

  expect(tree.name).toBe("svg");
  const annotation =
    score.annotation instanceof exsurge.Annotation
      ? score.annotation.sourceGabc
      : undefined;
  return {
    svgChildren: tree.children?.length ?? 0,
    playbackEvents: exsurge.createPlaybackEvents(score, {}).events.length,
    hasDropCap: Boolean(score.dropCap),
    annotation,
  };
}

test.each(matrix)(
  "[$locale/$mode] $name scores render and play",
  async ({ locale, mode, render }) => {
    const repo = await loadSampleRepo(locale);
    const assembler = new HtmlAssembler({ outputMode: mode });
    const assembled = render(assembler, buildSampleAbstractDay(), repo);
    const html = assembled.html();
    const mounts = extractMounts(html);

    // The markup and the side-channel must agree: this is what proves the
    // attribute escaping round-trips a GABC body without corrupting it.
    expect(mounts.map((m) => m.id)).toEqual([...assembler.getScores().keys()]);
    expect(assembled.scores.map((s) => s.id)).toEqual(mounts.map((m) => m.id));
    for (const mount of mounts) {
      expect(mount.gabc).toBe(assembler.getScores().get(mount.id));
    }

    // Mode lives on the GABC header (drawn above the drop cap), not as a
    // caption above the score.
    expect(html).not.toMatch(/loth-melody-rubric">Mode /);

    // Every sample locale carries melodies, so a run with no mounts at all
    // means the refs stopped resolving rather than that there is nothing to
    // sing.
    expect(mounts.length).toBeGreaterThan(0);

    let modeHeaders = 0;
    for (const spec of assembled.scores) {
      expect(spec.gabc, `${spec.id} lacks a GABC header`).toContain("\n%%\n");
      expect(parenBalance(spec.gabc), `${spec.id} GABC parens`).toBe("");

      const result = await renderHeadless(spec);
      expect(result.svgChildren, `${spec.id} rendered no notation`).toBeGreaterThan(0);
      expect(result.playbackEvents, `${spec.id} has no playable notes`).toBeGreaterThan(0);

      if (spec.psalmTone) {
        expect(result.hasDropCap, `${spec.id} psalm tone grew a drop cap`).toBe(false);
        expect(spec.gabc, `${spec.id} psalm tone carried mode:`).not.toMatch(/^mode:/m);
        expect(result.annotation, `${spec.id} psalm tone grew an annotation`).toBeUndefined();
      } else {
        // Merged dialogues start with `<sp>V/</sp>` / `<sp>R/</sp>`; exsurge
        // has no letter to take as an initial, so no drop cap is drawn.
        expect(result.hasDropCap, `${spec.id} drop cap`).toBe(
          gabcStartsWithLetter(spec.gabc),
        );
        const modeMatch = spec.gabc.match(/^mode:\s*(\d+);$/m);
        if (modeMatch) {
          modeHeaders += 1;
          const n = Number(modeMatch[1]);
          expect(result.annotation, `${spec.id} missing mode annotation`).toBe(
            MODE_ROMAN[n],
          );
        } else {
          expect(result.annotation, `${spec.id} invented an annotation`).toBeUndefined();
        }
      }
    }
    expect(modeHeaders, "no lyric score received a mode: header").toBeGreaterThan(0);
  },
  60_000,
);
