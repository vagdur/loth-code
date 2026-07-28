/**
 * The HTML and LaTeX renderers must stay slot-for-slot mirrors.
 *
 * They agree by construction — HtmlAssembler is a structural copy of
 * TexAssembler — but nothing in the type system says so, and the two are easy
 * to drift apart one edit at a time. These checks pin the two things that
 * would break first: the order and numbering of the scores, and the GABC each
 * one carries. The HTML inlines it in `data-gabc`; the LaTeX side writes it to
 * a sibling `<score-id>.gabc`. They must be the same bytes.
 *
 * Regenerate both sides together: `npm run test:fixtures:update`.
 */

import { existsSync, readFileSync } from "fs";
import path from "path";
import { expect, test } from "vitest";
import { SAMPLE_LOCALES } from "../helpers/buildSampleDay.js";
import { normalizeLf } from "../helpers/normalizeLf.js";
import { fixturesDir } from "../helpers/paths.js";

const JOBS = [
  "office-of-readings", "lauds", "sext", "vespers", "compline", "day",
] as const;

/** Only the modes that emit scores; `plain` has none on either side. */
const SUFFIXES = ["", "-scored"] as const;

const matrix = SAMPLE_LOCALES.flatMap((locale) =>
  JOBS.flatMap((job) => SUFFIXES.map((suffix) => ({ job, locale, suffix }))),
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

function fixture(job: string, locale: string, suffix: string, ext: string): string {
  return path.join(fixturesDir, `${job}-${locale}-2026-05-10-general${suffix}.${ext}`);
}

test.each(matrix)(
  "[$locale$suffix] $job HTML and TeX agree on every score",
  ({ job, locale, suffix }) => {
    const html = normalizeLf(readFileSync(fixture(job, locale, suffix, "html"), "utf-8"));
    const tex = normalizeLf(readFileSync(fixture(job, locale, suffix, "tex"), "utf-8"));

    const htmlScores = [
      ...html.matchAll(/data-score-id="([^"]*)" data-gabc="([^"]*)"/g),
    ].map((m) => ({ id: m[1] ?? "", gabc: unescapeHtmlAttr(m[2] ?? "") }));

    // \lothScore{…} and \psalmToneScore{…}, in document order.
    const texScoreIds = [...tex.matchAll(/\\(?:loth|psalmTone)Score\{([^}]*)\}/g)]
      .map((m) => m[1] ?? "");

    expect(htmlScores.map((s) => s.id)).toEqual(texScoreIds);

    // The LaTeX side's sibling .gabc is the same score the HTML inlines.
    for (const score of htmlScores) {
      const gabcPath = path.join(fixturesDir, `${score.id}.gabc`);
      expect(existsSync(gabcPath), `missing golden ${score.id}.gabc`).toBe(true);
      expect(score.gabc.trimEnd()).toBe(
        normalizeLf(readFileSync(gabcPath, "utf-8")).trimEnd(),
      );
    }
  },
);

test.each(SAMPLE_LOCALES)("[%s] plain mode emits no scores in either renderer", (locale) => {
  for (const job of JOBS) {
    const html = readFileSync(fixture(job, locale, "-plain", "html"), "utf-8");
    const tex = readFileSync(fixture(job, locale, "-plain", "tex"), "utf-8");
    expect(html, `${job} HTML`).not.toContain("data-loth-score");
    expect(tex, `${job} TeX`).not.toContain("Score{");
  }
});
