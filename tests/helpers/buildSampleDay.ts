import { resolveDay, defaultContext } from "../../src/calendar/index.js";
import { DataRepository } from "../../src/data/repository.js";
import { buildDay } from "../../src/hours/index.js";
import { dataRoot, defaultLocale } from "./paths.js";

/** Same sample as integration fixtures: 6th Sunday of Easter, Week II. */
export const SAMPLE_DATE = new Date("2026-05-10T00:00:00Z");
export const SAMPLE_CALENDAR = "general" as const;

export async function loadSampleRepo(): Promise<DataRepository> {
  return DataRepository.load(dataRoot, defaultLocale);
}

export function buildSampleAbstractDay() {
  const liturgicalDay = resolveDay(SAMPLE_DATE, SAMPLE_CALENDAR);
  const ctx = defaultContext();
  return buildDay(liturgicalDay, ctx);
}
