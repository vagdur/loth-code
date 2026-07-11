import { describe, expect, test } from "vitest";
import { lookupSeasonalName } from "../../src/ordo/seasonalNames.js";

describe("lookupSeasonalName", () => {
  const names = {
    baptismOfLord: "Herrens dop",
    christmasDec25: "Juldagen",
  };

  test("resolves snake_case keys against camelCase yaml entries", () => {
    expect(lookupSeasonalName("baptism_of_lord", names)).toBe("Herrens dop");
    expect(lookupSeasonalName("christmas_dec25", names)).toBe("Juldagen");
  });
});
