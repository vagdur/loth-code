/**
 * Display reassembly of split GABC: openings, short responsories, closings
 * emit as one score with ℣./℟. labels.
 */

import { describe, expect, test } from "vitest";
import {
  assembleDialogueGabc,
  assembleShortResponsoryGabc,
  COMPLINE_BLESSING_PARTS,
  DISMISSAL_PARTS,
  INTRO_VERSE_PARTS,
  INVITATORY_VERSE_PARTS,
  OOR_ACCLAMATION_PARTS,
} from "../../src/assemblers/gabcDisplay.js";
import { HtmlAssembler } from "../../src/assemblers/htmlAssembler.js";
import { TexAssembler } from "../../src/assemblers/texAssembler.js";
import { eveningVespers } from "../../src/hours/index.js";
import type { DialogueMelody, ShortResponsoryMelody } from "../../src/types/texts.js";
import {
  buildSampleAbstractDay, loadSampleRepo,
} from "../helpers/buildSampleDay.js";

const intro: DialogueMelody = {
  versicle: "(c4) Gud,(j) kom.(j)",
  response: "(c4) Her(j)re,(h) hjälp.(h)",
  gloria: "(c4) Ä(j)ra(j) va(i)re.(h) (::) A(gh)men.(g)",
  alleluia: "(c4) Al(j)le(k)lu(j)ia.(i)",
};

describe("assembleDialogueGabc", () => {
  test("the invitatory opening is one staff with V. then R.", () => {
    const out = assembleDialogueGabc(intro, INVITATORY_VERSE_PARTS);
    expect(out).toBe(
      "(c4) <sp>V/</sp>Gud,(j) kom.(j) (:) <sp>R/</sp>Her(j)re,(h) hjälp.(h) (::)",
    );
    expect(out).not.toContain("(Z)");
    expect(out).not.toContain("Ä(j)ra");
  });

  test("the intro of the other hours stacks V., R., then V.+R. Gloria", () => {
    const out = assembleDialogueGabc(intro, INTRO_VERSE_PARTS);
    const lines = out.split("(Z)\n");
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain("<sp>V/</sp>Gud,(j) kom.(j)");
    expect(lines[1]).toContain("<sp>R/</sp>Her(j)re,(h) hjälp.(h)");
    expect(lines[2]).toContain("<sp>V/</sp>+<sp>R/</sp>Ä(j)ra");
    expect(lines[2]).toContain("A(gh)men.(g) (:) Al(j)le(k)lu(j)ia.(i)");
  });

  test("Lent drops the alleluia by omitting that part", () => {
    const parts = INTRO_VERSE_PARTS.filter((p) => p.key !== "alleluia");
    const out = assembleDialogueGabc(intro, parts);
    expect(out).not.toContain("Al(j)le");
    expect(out).toContain("<sp>V/</sp>+<sp>R/</sp>Ä(j)ra");
  });

  test("the OoR closing is V. and R. on one staff", () => {
    const out = assembleDialogueGabc(
      { versicle: "(c4) Låt(f) oss(g) pri(f)sa.(f)", response: "(c4) Gud,(f) vi(g) tack(f)ar.(f)" },
      OOR_ACCLAMATION_PARTS,
    );
    expect(out).toBe(
      "(c4) <sp>V/</sp>Låt(f) oss(g) pri(f)sa.(f) (:) <sp>R/</sp>Gud,(f) vi(g) tack(f)ar.(f) (::)",
    );
  });

  test("compline blessing puts Amen on the next staff", () => {
    const out = assembleDialogueGabc(
      { versicle: "(c4) En(f) stil(g)la(f) natt.(f)", response: "(c4) A(fg)men.(f)" },
      COMPLINE_BLESSING_PARTS,
    );
    expect(out).toContain("(Z)\n<sp>R/</sp>A(fg)men.(f)");
    expect(out).toContain("<sp>V/</sp>En(f) stil(g)la(f) natt.(f)");
  });

  test("the simpler dismissal keeps R. Amen on the same staff", () => {
    const out = assembleDialogueGabc(
      { blessing: "(c4) Her(f)ren(g) väl(f)sig(e)ne.(f)", amen: "(c4) A(fg)men.(f)" },
      DISMISSAL_PARTS,
    );
    expect(out).toBe(
      "(c4) Her(f)ren(g) väl(f)sig(e)ne.(f) (:) <sp>R/</sp>A(fg)men.(f) (::)",
    );
    expect(out).not.toContain("<sp>V/</sp>");
  });
});

describe("assembleShortResponsoryGabc", () => {
  const melody: ShortResponsoryMelody = {
    responsory: "(c4) Her(f)ren(g) är(h) min(g) klip(f)pa.(e) (::)",
    responsorySecond: "(c4) jag(f) hop(g)pas(h) på(g) ho(f)nom.(e) (::)",
    versicle: "(c4) Han(f) är(g) min(h) borg.(g) (::)",
    gloria: "(c4) Ä(f)ra(g) va(h)re(g) Fa(f)dern.(e)",
  };

  test("three staves: full R., V. plus repeat, V. Gloria plus expanded R.", () => {
    const out = assembleShortResponsoryGabc(melody);
    const lines = out.split("(Z)\n");
    expect(lines).toHaveLength(3);

    expect(lines[0]).toMatch(/^(\(c4\) )?<sp>R\/<\/sp>/);
    expect(lines[0]).toContain("klip(f)pa.(e) +(:) jag(f) hop(g)pas");

    expect(lines[1]).toMatch(/^<sp>V\/<\/sp>/);
    expect(lines[1]).toContain("borg.(g) (::) + jag(f) hop(g)pas");

    expect(lines[2]).toMatch(/^<sp>V\/<\/sp>/);
    expect(lines[2]).toContain("<sp>R/</sp>Her(f)ren(g) är(h) min(g) klip(f)pa.(e) +(:)");
    expect(lines[2]).toContain("jag(f) hop(g)pas(h) på(g) ho(f)nom.(e)");
  });

  test("missing halves still emit the parts that exist", () => {
    const out = assembleShortResponsoryGabc({
      responsory: "(c4) On(f)ly.(f)",
      versicle: "(c4) Verse.(f)",
    });
    expect(out).toContain("<sp>R/</sp>On(f)ly.(f)");
    expect(out).toContain("<sp>V/</sp>Verse.(f)");
    expect(out).not.toContain("+(:)");
  });
});

describe("assemblers emit one score per merged slot", () => {
  test("vespers intro, responsory and dismissal are each a single GABC file", async () => {
    const repo = await loadSampleRepo();
    const day = buildSampleAbstractDay();
    const assembler = new TexAssembler();
    assembler.assembleVespers(eveningVespers(day), repo);
    const files = assembler.getGabcFiles();

    const intro = [...files.entries()].find(([, g]) => g.includes("Sam(j)ple(j) ver(i)si(h)cle"));
    expect(intro, "intro verse score").toBeDefined();
    const introGabc = intro![1];
    expect(introGabc).toContain("<sp>V/</sp>Sam(j)ple(j) ver(i)si(h)cle.(j)");
    expect(introGabc).toContain("<sp>R/</sp>Sam(j)ple(j) re(i)sponse.(h)");
    expect(introGabc).toContain("<sp>V/</sp>+<sp>R/</sp>Sam(j)ple(j) do(i)xo(h)lo(j)gy");
    expect(introGabc).toContain("Al(j)le(k)lu(j)ia.(i)");
    expect([...files.values()].filter((g) => g.includes("Sam(j)ple(j) ver(i)si(h)cle")).length).toBe(1);

    const resp = [...files.values()].find((g) => g.includes("short(g) re(f)spon"));
    expect(resp, "short responsory score").toBeDefined();
    expect(resp).toContain("<sp>R/</sp>Sam(f)ple(f) short(g) re(f)spon(e)so(f)ry.(f) +(:)");
    expect(resp).toContain("<sp>V/</sp>Sam(f)ple(g) ver(f)si(e)cle(f) line.(f)");
    expect(resp).toContain("<sp>R/</sp>Sam(f)ple(f) short(g) re(f)spon(e)so(f)ry.(f)");
    expect([...files.values()].filter((g) => g.includes("short(g) re(f)spon")).length).toBe(1);

    const dismissal = [...files.values()].find((g) => g.includes("bles(f)sing"));
    expect(dismissal, "dismissal score").toBeDefined();
    expect(dismissal).toContain("<sp>R/</sp>A(fg)men.(f)");
    expect([...files.values()].filter((g) => g.includes("bles(f)sing")).length).toBe(1);
  });

  test("HTML and TeX emit the same merged GABC for vespers", async () => {
    const repo = await loadSampleRepo();
    const day = buildSampleAbstractDay();
    const tex = new TexAssembler();
    tex.assembleVespers(eveningVespers(day), repo);
    const html = new HtmlAssembler();
    html.assembleVespers(eveningVespers(day), repo);

    const texBodies = [...tex.getGabcFiles().values()].map((g) =>
      g.replace(/^name:[^;]+;\n%%\n/, ""),
    );
    const htmlBodies = [...html.getScores().values()].map((g) =>
      g.replace(/^name:[^;]+;\n%%\n/, ""),
    );
    expect(htmlBodies).toEqual(texBodies);
  });
});
