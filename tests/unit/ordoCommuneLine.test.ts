import { describe, expect, test } from "vitest";
import { joinOr, formatDayCommuneLine } from "../../src/ordo/communeLine.js";
import type { OrdoLabels } from "../../src/types/texts.js";

const labels = {
  prose: {
    dayCommune: "Commune: {name}",
    or: "eller",
  },
} as OrdoLabels;

describe("joinOr", () => {
  test("two names", () => {
    expect(joinOr(["en martyr", "herdar"], "eller")).toBe("en martyr eller herdar");
  });

  test("three names", () => {
    expect(joinOr(["a", "b", "c"], "eller")).toBe("a, b eller c");
  });
});

describe("formatDayCommuneLine", () => {
  test("wraps joined commons", () => {
    expect(formatDayCommuneLine("en martyr eller herdar", labels)).toBe(
      "Commune: en martyr eller herdar",
    );
  });
});
