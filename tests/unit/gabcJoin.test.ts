/**
 * Joining separately stored GABC bodies into one display score.
 */

import { describe, expect, test } from "vitest";
import {
  applyPrefix,
  joinGabc,
  joinGloriaWithResponse,
  joinResponseHalves,
  joinVerseWithRepeat,
  splitClef,
  stripMatchingClef,
  stripTrailingBar,
} from "../../src/tools/gabcJoin.js";

describe("splitClef", () => {
  test("pulls a leading c4 clef off the body", () => {
    expect(splitClef("(c4) Sam(f)ple.(f)")).toEqual({
      clef: "(c4)",
      body: "Sam(f)ple.(f)",
    });
  });

  test("keeps a cb4 key-signature clef", () => {
    expect(splitClef("(cb4) Sam(f)ple.(f)").clef).toBe("(cb4)");
  });

  test("leaves a body with no clef alone", () => {
    expect(splitClef("Sam(f)ple.(f)")).toEqual({
      clef: "",
      body: "Sam(f)ple.(f)",
    });
  });
});

describe("joinGabc", () => {
  test("a single segment is prefixed and given a final bar", () => {
    expect(joinGabc([{ gabc: "(c4) Sam(f)ple.(f)", prefix: "V" }]))
      .toBe("(c4) <sp>V/</sp>Sam(f)ple.(f) (::)");
  });

  test("does not double a prefix the body already carries", () => {
    expect(joinGabc([{ gabc: "(c4) <sp>V/</sp>Sam(f)ple.(f)", prefix: "V" }]))
      .toBe("(c4) <sp>V/</sp>Sam(f)ple.(f) (::)");
  });

  test("inline attach keeps V. and R. on one staff, inserting a bar if needed", () => {
    const out = joinGabc([
      { gabc: "(c4) O(f)pen.(f)", prefix: "V" },
      { gabc: "(c4) Praise.(f)", prefix: "R", attach: "inline" },
    ]);
    expect(out).toBe(
      "(c4) <sp>V/</sp>O(f)pen.(f) (:) <sp>R/</sp>Praise.(f) (::)",
    );
  });

  test("line attach stacks parts on new staves", () => {
    const out = joinGabc([
      { gabc: "(c4) O(f)pen.(f)", prefix: "V" },
      { gabc: "(c4) Help.(f)", prefix: "R", attach: "line" },
    ]);
    expect(out).toBe(
      "(c4) <sp>V/</sp>O(f)pen.(f) (::) (Z)\n<sp>R/</sp>Help.(f) (::)",
    );
  });

  test("Gloria carries the combined V.+R. prefix", () => {
    const out = joinGabc([
      { gabc: "(c4) O(f)pen.(f)", prefix: "V" },
      { gabc: "(c4) Help.(f)", prefix: "R", attach: "line" },
      { gabc: "(c4) Glo(f)ry.(f) (::) A(fg)men.(f)", prefix: "VR", attach: "line" },
      { gabc: "(c4) Al(j)le(k)lu(j)ia.(i)", attach: "inline" },
    ]);
    expect(out).toContain("<sp>V/</sp>+<sp>R/</sp>Glo(f)ry.(f)");
    expect(out).toContain("A(fg)men.(f) (:) Al(j)le(k)lu(j)ia.(i)");
    expect(out).not.toMatch(/\(Z\)\nAl/);
  });

  test("a later clef that matches the first is stripped", () => {
    expect(stripMatchingClef("(c4) Help.(f)", "(c4)")).toBe("Help.(f)");
  });

  test("a later clef that differs from the first is kept", () => {
    expect(stripMatchingClef("(c3) Help.(f)", "(c4)")).toBe("(c3) Help.(f)");
  });

  test("a later change of clef keeps the ℣./℟. special after that clef", () => {
    const out = joinGabc([
      { gabc: "(c4) O(f)pen.(f)", prefix: "V" },
      { gabc: "(c3) Help.(f)", prefix: "R", attach: "line" },
    ]);
    expect(out).toBe(
      "(c4) <sp>V/</sp>O(f)pen.(f) (::) (Z)\n(c3) <sp>R/</sp>Help.(f) (::)",
    );
    expect(out).not.toMatch(/<sp>R\/<\/sp>\(c3\)/);
  });

  test("inline attach also puts the prefix after a change of clef", () => {
    const out = joinGabc([
      { gabc: "(c4) O(f)pen.(f)", prefix: "V" },
      { gabc: "(c3) Praise.(f)", prefix: "R", attach: "inline" },
    ]);
    expect(out).toBe(
      "(c4) <sp>V/</sp>O(f)pen.(f) (:) (c3) <sp>R/</sp>Praise.(f) (::)",
    );
  });

  test("empty segments are skipped", () => {
    expect(joinGabc([
      { gabc: "  " },
      { gabc: "(c4) Only.(f)", prefix: "V" },
    ])).toBe("(c4) <sp>V/</sp>Only.(f) (::)");
  });
});

describe("short responsory joins", () => {
  const first = "(c4) Her(f)ren(g) är(h) min(g) klip(f)pa.(e) (::)";
  const second = "(c4) jag(f) hop(g)pas(h) på(g) ho(f)nom.(e) (::)";
  const verse = "(c4) Han(f) är(g) min(h) borg.(g) (::)";
  const gloria = "(c4) Ä(f)ra(g) va(h)re(g) Fa(f)dern.(e)";

  test("response halves meet at a plus on a single bar", () => {
    const out = joinResponseHalves(first, second);
    expect(out).toBe(
      "(c4) Her(f)ren(g) är(h) min(g) klip(f)pa.(e) +(:) jag(f) hop(g)pas(h) på(g) ho(f)nom.(e) (::)",
    );
    expect(stripTrailingBar("klip(f)pa.(e) (::)")).toBe("klip(f)pa.(e)");
  });

  test("the verse keeps its double bar, then plus and the second half", () => {
    expect(joinVerseWithRepeat(verse, second)).toBe(
      "(c4) Han(f) är(g) min(h) borg.(g) (::) + jag(f) hop(g)pas(h) på(g) ho(f)nom.(e) (::)",
    );
  });

  test("the Gloria is followed by the full response, not a cue", () => {
    const response = joinResponseHalves(first, second);
    const out = joinGloriaWithResponse(gloria, response);
    expect(out).toContain("<sp>R/</sp>Her(f)ren(g) är(h) min(g) klip(f)pa.(e) +(:)");
    expect(out.startsWith("(c4) Ä(f)ra")).toBe(true);
    expect(out).toContain("(::) <sp>R/</sp>");
  });

  test("a Gloria and response in different clefs keep ℟. after the new clef", () => {
    const out = joinGloriaWithResponse(
      gloria,
      "(c3) Her(f)ren(g) är(h) min(g) klip(f)pa.(e) (::)",
    );
    expect(out).toBe(
      "(c4) Ä(f)ra(g) va(h)re(g) Fa(f)dern.(e) (::) (c3) <sp>R/</sp>Her(f)ren(g) är(h) min(g) klip(f)pa.(e) (::)",
    );
    expect(out).not.toMatch(/<sp>R\/<\/sp>\(c3\)/);
  });

  test("applyPrefix writes V. immediately before the first syllable", () => {
    expect(applyPrefix("Sam(f)ple.(f)", "V")).toBe("<sp>V/</sp>Sam(f)ple.(f)");
    expect(applyPrefix("Sam(f)ple.(f)", "VR")).toBe("<sp>V/</sp>+<sp>R/</sp>Sam(f)ple.(f)");
  });
});
