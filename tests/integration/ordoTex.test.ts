/**
 * Regenerate goldens: `npm run test:fixtures:update` (sets UPDATE_FIXTURES=1).
 * Refresh reference PDFs: `npm run test:fixtures:compile-pdf`.
 */

import { readFileSync } from "fs";
import path from "path";
import { beforeAll, expect, test } from "vitest";
import { SanctoralCalendarRegistry } from "../../src/calendar/sanctoralRegistry.js";
import { initSanctoralRegistry } from "../../src/calendar/saints.js";
import { utcDate } from "../../src/calendar/computus.js";
import { DataRepository } from "../../src/data/repository.js";
import { assembleOrdoDocument } from "../../src/assemblers/ordoTex.js";
import {
  eachDayInRange,
  liturgicalYearRange,
  ordoContext,
  summarizeOrdoDay,
} from "../../src/ordo/index.js";
import { writeFixtureTex } from "../helpers/compileFixtureTex.js";
import { normalizeLf } from "../helpers/normalizeLf.js";
import { dataRoot, fixturesDir } from "../helpers/paths.js";

const calendarId = "stockholm";
const yearEnd = 2026;
const singleDayFixtureName = "ordo-2026-07-11-stockholm.tex";
const yearFixtureName = `ordo-${yearEnd - 1}-${yearEnd}.tex`;
let repo: DataRepository;

beforeAll(async () => {
  const registry = await SanctoralCalendarRegistry.load(dataRoot, "sv");
  initSanctoralRegistry(registry);
  repo = await DataRepository.load(dataRoot, "sv");
});

async function assertOrdoTexFixture(fixtureName: string, tex: string): Promise<void> {
  const fixturePath = path.join(fixturesDir, fixtureName);

  if (process.env.UPDATE_FIXTURES === "1") {
    writeFixtureTex(fixturePath, tex, new Map());
  }

  const expected = normalizeLf(readFileSync(fixturePath, "utf-8"));
  expect(tex).toBe(expected);
}

test("Ordo TeX matches fixture for 2026-07-11 Stockholm", async () => {
  const ctx = ordoContext(calendarId);
  const summary = summarizeOrdoDay(utcDate(2026, 7, 11), ctx, repo);
  const tex = normalizeLf(
    assembleOrdoDocument([summary], repo, "Ordo — test — 2026-07-11"),
  );
  await assertOrdoTexFixture(singleDayFixtureName, tex);
}, 5_000);

test("Ordo TeX matches fixture for liturgical year 2025/2026 Stockholm", async () => {
  const ctx = ordoContext(calendarId);
  const range = liturgicalYearRange(yearEnd, calendarId);
  const summaries = [...eachDayInRange(range)].map((date) =>
    summarizeOrdoDay(date, ctx, repo),
  );
  const tex = normalizeLf(assembleOrdoDocument(summaries, repo));
  await assertOrdoTexFixture(yearFixtureName, tex);
}, 10_000);
