import { describe, expect, test } from "vitest";
import { DataRepository } from "../../src/data/repository.js";
import {
  formatGospelCanticlePlain, formatIntroductoryVersePlain, formatTeDeumPlain,
} from "../../src/assemblers/liturgicalText.js";
import { makeFlags } from "../../src/hours/shared.js";
import { dataDir } from "../helpers/paths.js";

describe("FixedTexts and repository", () => {
  test("loads fixed_texts.yaml with gospel canticles", async () => {
    const repo = await DataRepository.load(dataDir);
    const fixed = repo.getFixedTexts();
    expect(fixed).toBeDefined();
    expect(repo.getGospelCanticle("benedictus")?.reference).toBe("Lk 1:68-79");
    expect(repo.getTeDeum()?.text).toContain("Te Deum");
  });

  test("complementary group resolves via repository", async () => {
    const repo = await DataRepository.load(dataDir);
    const group = repo.getComplementaryGroup("complementary_sunday_sext");
    expect(group?.psalmAssignments).toHaveLength(3);
    const assignment = repo.resolve({
      kind: "complementary",
      groupId: "complementary_sunday_sext",
      index: 0,
    });
    expect(assignment).toBeDefined();
  });

  test("liturgicalText reads introductory verse from fixed texts", async () => {
    const repo = await DataRepository.load(dataDir);
    const flags = makeFlags(
      {
        date: new Date("2026-05-10T00:00:00Z"),
        season: "eastertide",
        psalterWeek: 2,
        psalterDay: "Sunday",
        readingYear: "II",
        ordinaryTimeWeek: 0,
        celebration: {
          type: "sunday",
          source: "seasonal",
          seasonalKey: "easter_w6_sun",
          applicableCommons: [],
          memoriaFullySuppressed: false,
        },
        evening: { hasFirstVespers: false },
        saturdayBvmPermitted: false,
      },
      false,
    );
    const text = formatIntroductoryVersePlain(repo, flags);
    expect(text).toContain("[O God, come to our aid]");
    expect(text).toContain("alleluia");
    expect(formatGospelCanticlePlain(repo, "benedictus")).toContain("[Benedictus");
    expect(formatTeDeumPlain(repo)).toContain("[Te Deum");
  });
});
