/**
 * Regenerate goldens: `npm run test:fixtures:update` (sets UPDATE_FIXTURES=1).
 */

import { readFileSync } from "fs";
import path from "path";
import { beforeAll, expect, test } from "vitest";
import { SanctoralCalendarRegistry } from "../../src/calendar/sanctoralRegistry.js";
import { initSanctoralRegistry } from "../../src/calendar/saints.js";
import { utcDate } from "../../src/calendar/computus.js";
import { DataRepository } from "../../src/data/repository.js";
import { assembleOrdoDocument } from "../../src/assemblers/ordoTex.js";
import { ordoContext, summarizeOrdoDay } from "../../src/ordo/index.js";
import { writeFixtureTexAndPdf } from "../helpers/compileFixtureTex.js";
import { gregorioAutocompileWorks } from "../helpers/gregorioAutocompile.js";
import { normalizeLf } from "../helpers/normalizeLf.js";
import { dataRoot, fixturesDir } from "../helpers/paths.js";

const fixtureName = "ordo-2026-07-11-stockholm.tex";
let repo: DataRepository;

beforeAll(async () => {
  const registry = await SanctoralCalendarRegistry.load(dataRoot, "sv");
  initSanctoralRegistry(registry);
  repo = await DataRepository.load(dataRoot, "sv");
});

test("Ordo TeX matches fixture for 2026-07-11 Stockholm", async () => {
  const ctx = ordoContext("stockholm");
  const summary = summarizeOrdoDay(utcDate(2026, 7, 11), ctx, repo);
  const tex = normalizeLf(
    assembleOrdoDocument([summary], repo, "Ordo — test — 2026-07-11"),
  );
  const fixturePath = path.join(fixturesDir, fixtureName);

  if (process.env.UPDATE_FIXTURES === "1") {
    await writeFixtureTexAndPdf(fixturePath, tex, "ordo", gregorioAutocompileWorks);
  }

  const expected = normalizeLf(readFileSync(fixturePath, "utf-8"));
  expect(tex).toBe(expected);
}, process.env.UPDATE_FIXTURES === "1" ? 180_000 : 5_000);
