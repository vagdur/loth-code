/**
 * Mode is a property of the melody (GABC header), never a text caption.
 */

import { expect, test } from "vitest";
import { HtmlAssembler } from "../../src/assemblers/htmlAssembler.js";
import {
  htmlMelodyRubric, htmlScoredMelodyRubric,
} from "../../src/assemblers/liturgicalHtml.js";
import {
  texMelodyRubric, texScoredMelodyRubric,
} from "../../src/assemblers/liturgicalTex.js";
import { renderHtml } from "../../src/assemblers/tree.js";
import {
  buildSampleAbstractDay, loadSampleRepo,
} from "../helpers/buildSampleDay.js";

test("texMelodyRubric omits mode and keeps the editorial note", () => {
  expect(texMelodyRubric({ mode: 8 })).toBe("");
  expect(texMelodyRubric({ mode: 8, note: "simple tone" })).toBe(
    "\\melodyRubric{simple tone}",
  );
  expect(texScoredMelodyRubric({ note: "simple tone" })).toBe(
    "\\melodyRubric{simple tone}",
  );
});

test("htmlMelodyRubric omits mode and keeps the editorial note", () => {
  expect(htmlMelodyRubric({ mode: 8 })).toBeNull();
  const noted = htmlMelodyRubric({ mode: 8, note: "simple tone" });
  expect(noted).not.toBeNull();
  expect(renderHtml(noted!)).toBe(
    '<p class="loth-melody-rubric">simple tone</p>',
  );
  const scored = htmlScoredMelodyRubric({ note: "simple tone" });
  expect(scored).not.toBeNull();
  expect(renderHtml(scored!)).toBe(
    '<p class="loth-melody-rubric">simple tone</p>',
  );
});

test("plain HTML output has no Mode captions", async () => {
  const repo = await loadSampleRepo("en");
  const day = buildSampleAbstractDay();
  const html = new HtmlAssembler({ outputMode: "plain" })
    .assembleLauds(day.lauds, repo)
    .html();
  expect(html).not.toMatch(/loth-melody-rubric">Mode /);
  expect(html).toMatch(/loth-antiphon/);
});
