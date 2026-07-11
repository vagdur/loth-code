import { describe, expect, test } from "vitest";
import { utcDate } from "../../src/calendar/computus.js";
import { christmasSundayNumber } from "../../src/ordo/christmasSunday.js";

describe("christmasSundayNumber", () => {
  test("2026-01-04 is the second Christmas-season Sunday after Dec 25 2025", () => {
    expect(christmasSundayNumber(utcDate(2026, 1, 4), "stockholm")).toBe(2);
  });
});
