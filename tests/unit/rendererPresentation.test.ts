/**
 * Presentation contract for the HTML and TeX renderers: every section has a
 * heading, and the hour title is split from the liturgical-day line.
 *
 * Colour ("do the red, say the black") lives in html/loth.css and tex/loth.sty;
 * these checks pin the markup those files style.
 */

import { readFileSync } from "fs";
import path from "path";
import { expect, test } from "vitest";
import { HtmlAssembler } from "../../src/assemblers/htmlAssembler.js";
import { PlainTextAssembler } from "../../src/assemblers/plainText.js";
import { TexAssembler } from "../../src/assemblers/texAssembler.js";
import {
  buildSampleAbstractDay, loadSampleRepo,
} from "../helpers/buildSampleDay.js";
import { repoRoot } from "../helpers/paths.js";

const LAUDS_SECTIONS = [
  "INVITATORY",
  "HYMN",
  "PSALMODY",
  "READING",
  "RESPONSORY",
  "BENEDICTUS",
  "INTERCESSIONS",
  "OUR FATHER",
  "CONCLUDING PRAYER",
  "DISMISSAL",
] as const;

test("assembler labels include the section headings used by every renderer", async () => {
  const repo = await loadSampleRepo();
  const { sections } = repo.getAssemblerLabels();
  expect(sections.invitatory).toBe("INVITATORY");
  expect(sections.introductoryVerse).toBe("INTRODUCTORY VERSE");
  expect(sections.hymn).toBe("HYMN");
  expect(sections.psalmody).toBe("PSALMODY");
  expect(sections.reading).toBe("READING");
  expect(sections.responsory).toBe("RESPONSORY");
  expect(sections.versicle).toBe("VERSICLE");
  expect(sections.concludingPrayer).toBe("CONCLUDING PRAYER");
  expect(sections.dismissal).toBe("DISMISSAL");
  expect(sections.examination).toBe("EXAMINATION OF CONSCIENCE");
  expect(sections.blessing).toBe("BLESSING");
  expect(sections.acclamation).toBe("ACCLAMATION");
  expect(sections.memoriaAddendum).toBe("COMMEMORATION");
});

test("Lauds HTML, TeX and plain text carry the same section headings", async () => {
  const repo = await loadSampleRepo();
  const day = buildSampleAbstractDay();

  const html = new HtmlAssembler({ outputMode: "plain" })
    .assembleLauds(day.lauds, repo)
    .html();
  const tex = new TexAssembler({ outputMode: "plain" }).assembleLauds(day.lauds, repo);
  const plain = new PlainTextAssembler().assembleLauds(day.lauds, repo);

  for (const heading of LAUDS_SECTIONS) {
    expect(html, `HTML missing ${heading}`).toContain(heading);
    expect(tex, `TeX missing ${heading}`).toContain(heading);
    expect(plain, `plain missing ${heading}`).toContain(heading);
  }

  expect(html).toContain('<h1 class="loth-hour-heading">LAUDS — MORNING PRAYER</h1>');
  expect(html).toContain('<p class="loth-day-heading">');
  expect(html).not.toContain("LAUDS — MORNING PRAYER - ");

  expect(tex).toContain("\\hourHeading{LAUDS — MORNING PRAYER}");
  expect(tex).toContain("\\dayHeading{");
  expect(tex).not.toContain("\\hourHeading{LAUDS — MORNING PRAYER - ");
});

test("scored Lauds still heads the Our Father when the prayer is a score", async () => {
  const repo = await loadSampleRepo();
  const day = buildSampleAbstractDay();
  const html = new HtmlAssembler({ outputMode: "scored" })
    .assembleLauds(day.lauds, repo)
    .html();
  const tex = new TexAssembler({ outputMode: "scored" }).assembleLauds(day.lauds, repo);

  expect(html).toMatch(/loth-section-heading">OUR FATHER</);
  expect(tex).toContain("\\sectionHeading{OUR FATHER}");
  expect(html).not.toContain("loth-lords-prayer");
  expect(tex).not.toMatch(/\\lordsPrayer\{/);
});

test("HTML wraps ℣/℟ that land in ordinary prose, matching TeX unicode mapping", async () => {
  const repo = await loadSampleRepo();
  const day = buildSampleAbstractDay();
  const html = new HtmlAssembler({ outputMode: "plain" })
    .assembleOfficeOfReadings(day.officeOfReadings, repo)
    .html();
  expect(html).toContain('<span class="loth-rubric">℣.</span>');
  expect(html).toContain('<span class="loth-rubric">℟.</span>');
});

test("stylesheet and sty agree on rubric red, and keep the hour title black", () => {
  const css = readFileSync(path.join(repoRoot, "html/loth.css"), "utf-8");
  const sty = readFileSync(path.join(repoRoot, "tex/loth.sty"), "utf-8");
  const chant = readFileSync(path.join(repoRoot, "src/browser/lothChant.ts"), "utf-8");

  expect(css).toMatch(/--loth-rubric:\s*#a4243b/i);
  expect(sty).toMatch(/\\definecolor\{lothrubric\}\{HTML\}\{A4243B\}/);

  expect(css).toMatch(/\.loth-hour-heading[\s\S]*?color:\s*var\(--loth-text\)/);
  expect(css).toMatch(/\.loth-section-heading[\s\S]*?color:\s*var\(--loth-rubric\)/);
  expect(css).toMatch(/\.loth-rubric[\s\S]*?color:\s*var\(--loth-rubric\)/);
  expect(css).toMatch(/\.loth-reference[\s\S]*?color:\s*var\(--loth-rubric\)/);
  expect(css).toMatch(
    /\.loth-rubric[\s\S]*?font-family:\s*"Georgia"[\s\S]*?"Exsurge Characters"/,
  );

  expect(sty).toContain("\\newcommand{\\hourHeading}[1]");
  expect(sty).toContain("\\color{lothtext}");
  expect(sty).toContain("\\newcommand{\\sectionHeading}[1]");
  expect(sty).toContain("\\color{lothrubric}");
  expect(sty).toContain("\\newcommand{\\lothRubric}[1]");
  expect(sty).toContain("\\newunicodechar{℣}{\\Vbar{}}");
  expect(sty).toContain("\\newunicodechar{℟}{\\Rbar{}}");

  expect(chant).toContain('ctxt.setRubricColor("#a4243b")');
  expect(chant).toContain('ctxt.textStyles.annotation.color = "#a4243b"');
});
