import { resolveDay, defaultContext } from "../../src/calendar/index.js";
import { DataRepository } from "../../src/data/repository.js";
import { buildDay } from "../../src/hours/index.js";
import { dataRoot, defaultLocale } from "./paths.js";

/** Same sample as integration fixtures: 6th Sunday of Easter, Week II. */
export const SAMPLE_DATE = new Date("2026-05-10T00:00:00Z");
export const SAMPLE_CALENDAR = "general" as const;

/**
 * Locales exercised by the assembler fixtures. `en` is dummy placeholder data
 * (no melodies); `sv` is real data that embeds GABC scores, so it also
 * exercises the `filecontents`/GregorioTeX path.
 */
export const SAMPLE_LOCALES = ["en", "sv"] as const;
export type SampleLocale = (typeof SAMPLE_LOCALES)[number];

export async function loadSampleRepo(
  locale: string = defaultLocale,
): Promise<DataRepository> {
  return DataRepository.load(dataRoot, locale);
}

export function buildSampleAbstractDay() {
  const liturgicalDay = resolveDay(SAMPLE_DATE, SAMPLE_CALENDAR);
  const ctx = defaultContext();
  return buildDay(liturgicalDay, ctx);
}
