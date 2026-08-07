import { resolveDay, defaultContext } from "../../src/calendar/index.js";
import { loadRepository } from "../../src/data/repositoryNode.js";
import { buildDay } from "../../src/hours/index.js";
import { dataRoot, defaultLocale } from "./paths.js";
import type { DataRepository } from "../../src/data/repository.js";

/** Same sample as integration fixtures: 6th Sunday of Easter, Week II. */
export const SAMPLE_DATE = new Date("2026-05-10T00:00:00Z");
export const SAMPLE_CALENDAR = "general" as const;

/**
 * Locales exercised by the assembler fixtures. `en` is placeholder data
 * throughout, including its melodies (data/en/melodies/sample.yaml), which is
 * what puts scores in the fixtures and exercises the `filecontents`/GregorioTeX
 * and exsurge paths.
 */
export const SAMPLE_LOCALES = ["en"] as const;
export type SampleLocale = (typeof SAMPLE_LOCALES)[number];

export async function loadSampleRepo(
  locale: string = defaultLocale,
): Promise<DataRepository> {
  return loadRepository(dataRoot, locale);
}

export function buildSampleAbstractDay() {
  const liturgicalDay = resolveDay(SAMPLE_DATE, SAMPLE_CALENDAR);
  const ctx = defaultContext();
  return buildDay(liturgicalDay, ctx);
}
