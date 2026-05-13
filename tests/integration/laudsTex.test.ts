/**
 * Regenerate goldens: `npm run test:fixtures:update` (sets UPDATE_FIXTURES=1).
 */

import { mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { expect, test } from "vitest";
import { LaudsTexAssembler } from "../../src/assemblers/laudsTex.js";
import { buildSampleAbstractDay, loadSampleRepo } from "../helpers/buildSampleDay.js";
import { normalizeLf } from "../helpers/normalizeLf.js";
import { fixturesDir } from "../helpers/paths.js";

const fixtureName = "lauds-2026-05-10-general.tex";

test("Lauds TeX matches fixture", async () => {
  const repo = await loadSampleRepo();
  const abs = buildSampleAbstractDay();
  const tex = normalizeLf(new LaudsTexAssembler().assembleLauds(abs.lauds, repo));
  const fixturePath = path.join(fixturesDir, fixtureName);

  if (process.env.UPDATE_FIXTURES === "1") {
    mkdirSync(fixturesDir, { recursive: true });
    writeFileSync(fixturePath, tex, "utf-8");
  }

  const expected = normalizeLf(readFileSync(fixturePath, "utf-8"));
  expect(tex).toBe(expected);
});
