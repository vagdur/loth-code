/**
 * Recovering plain text from GABC lyrics: syllables of one word rejoin, note
 * groups and untexted tokens drop out, and a recorded incipit is matched
 * against the recovered text.
 */

import { describe, expect, test } from "vitest";
import {
  gabcToText, normalizeForComparison, textMatchesIncipit,
} from "../../src/tools/gabcText.js";

describe("gabcToText", () => {
  test("rejoins the syllables of a word and drops the notes", () => {
    const gabc =
      "(c4) Sam(g)ple(g) an(h)ti(g)phon(f) one,(g) (,) sung(h) to(g) a(f) sam(g)ple(f) tune.(f) (::)";
    expect(gabcToText(gabc)).toBe("Sample antiphon one, sung to a sample tune.");
  });

  test("a tone with no lyrics reduces to nothing", () => {
    expect(gabcToText("(c4) (g) (h) (jr0) (i) (h) (jr1R) (:) (hr0) (g)")).toBe("");
  });

  test("drops special glyphs, formatting tags and elision braces", () => {
    expect(gabcToText("(c4) <sp>V/</sp>Sam(f)ple(g) <i>ver</i>(f)si(e)cle.(f)"))
      .toBe("Sample versicle.");
    expect(gabcToText("(c4) sam{ple}(f) word.(g)")).toBe("sample word.");
  });

  test("collapses the whitespace between tokens", () => {
    expect(gabcToText("(c4)   Sam(f)ple  \n  two.(g)")).toBe("Sample two.");
  });
});

describe("normalizeForComparison", () => {
  test("lowercases and reduces punctuation to single spaces", () => {
    expect(normalizeForComparison("Sample — Antiphon, one!")).toBe("sample antiphon one");
  });
});

describe("textMatchesIncipit", () => {
  const text = "Sample antiphon one, sung to a sample tune.";

  test("passes when the text opens with the incipit", () => {
    expect(textMatchesIncipit(text, "Sample antiphon one")).toBe(true);
  });

  test("ignores the syllable spacing raw incipits carry", () => {
    expect(textMatchesIncipit(text, "Sam ple an ti phon one")).toBe(true);
  });

  test("passes when a label-prefixed incipit contains the text's opening", () => {
    expect(
      textMatchesIncipit(text, "Lauds : antiphon 1 Sample antiphon one, sung to"),
    ).toBe(true);
  });

  test("fails on a different text", () => {
    expect(textMatchesIncipit(text, "Sample antiphon three")).toBe(false);
  });

  test("an empty incipit or text is not a mismatch to report", () => {
    expect(textMatchesIncipit(text, "")).toBe(true);
    expect(textMatchesIncipit("", "Sample antiphon one")).toBe(true);
  });
});
