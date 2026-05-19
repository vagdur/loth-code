import { describe, expect, test } from "vitest";
import { PlainTextAssembler } from "../../src/assemblers/plainText.js";
import {
  formatGospelCanticlePlain, formatIntroductoryVersePlain, formatTeDeumPlain,
} from "../../src/assemblers/liturgicalText.js";
import { DataRepository } from "../../src/data/repository.js";
import { makeFlags } from "../../src/hours/shared.js";
import { buildSampleAbstractDay, loadSampleRepo } from "../helpers/buildSampleDay.js";
import { dataRoot, defaultLocale } from "../helpers/paths.js";

describe("FixedTexts and repository", () => {
  test("loads fixed_texts.yaml with gospel canticles", async () => {
    const repo = await DataRepository.load(dataRoot, defaultLocale);
    const fixed = repo.getFixedTexts();
    expect(fixed).toBeDefined();
    expect(repo.getGospelCanticle("benedictus")?.reference).toBe("Lk 1:68-79");
    expect(repo.getTeDeum()?.text).toContain("Te Deum");
  });

  test("loads assembler labels from fixed_texts.yaml", async () => {
    const repo = await DataRepository.load(dataRoot, defaultLocale);
    const labels = repo.getAssemblerLabels();
    expect(labels.hours.lauds).toBe("LAUDS — MORNING PRAYER");
    expect(labels.sections.benedictus).toBe("BENEDICTUS");
    expect(labels.rubrics.letUsPray).toBe("Let us pray.");
    expect(labels.rubrics.antiphonPrefix).toBe("Ant.");
    expect(repo.locale).toBe("en");
  });

  test("complementary group resolves via repository", async () => {
    const repo = await DataRepository.load(dataRoot, defaultLocale);
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
    const repo = await DataRepository.load(dataRoot, defaultLocale);
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

  test("PlainTextAssembler uses section labels from data", async () => {
    const repo = await loadSampleRepo();
    const day = buildSampleAbstractDay();
    const labels = repo.getAssemblerLabels();
    const output = new PlainTextAssembler().assembleLauds(day.lauds, repo);
    expect(output).toContain(labels.sections.benedictus);
    expect(output).toContain(labels.rubrics.letUsPray);
  });
});
