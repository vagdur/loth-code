import { describe, expect, it } from "vitest";
import { diagnoseGregorio, formatGregorioDiagnosis } from "../helpers/diagnoseGregorio.js";

describe("diagnoseGregorio", () => {
  it("returns structured output", () => {
    const d = diagnoseGregorio();
    expect(d).toHaveProperty("ok");
    expect(d).toHaveProperty("issues");
    expect(Array.isArray(d.gregorioExecutables)).toBe(true);
    expect(formatGregorioDiagnosis(d)).toContain("GregorioTeX:");
  });
});
