/**
 * Mode is a property of the melody, not of the text: never a caption.
 */

import { expect, test } from "vitest";
import { HtmlAssembler } from "../../src/assemblers/htmlAssembler.js";
import { htmlMelodyRubric } from "../../src/assemblers/liturgicalHtml.js";
import { texMelodyRubric } from "../../src/assemblers/liturgicalTex.js";
import { renderHtml } from "../../src/assemblers/tree.js";
import {
  buildSampleAbstractDay, loadSampleRepo,
} from "../helpers/buildSampleDay.js";

test("melody rubric emits the editorial note and never the mode", () => {
  const withBoth = { mode: 8, note: "solemn tone" };
  const modeOnly = { mode: 8 };

  expect(texMelodyRubric(withBoth)).toBe("\\melodyRubric{solemn tone}");
  expect(texMelodyRubric(modeOnly)).toBe("");

  const html = htmlMelodyRubric(withBoth);
  expect(html).not.toBeNull();
  expect(renderHtml(html!)).toBe('<p class="loth-melody-rubric">solemn tone</p>');
  expect(htmlMelodyRubric(modeOnly)).toBeNull();
});

test("plain HTML output does not caption the antiphon mode", async () => {
  const repo = await loadSampleRepo("en");
  const day = buildSampleAbstractDay();
  const html = new HtmlAssembler({ outputMode: "plain" })
    .assembleLauds(day.lauds, repo)
    .html();

  expect(html).not.toMatch(/loth-melody-rubric">Mode /);
  expect(html).toContain("loth-antiphon");
});
