/**
 * Regenerate goldens: `npm run test:fixtures:update` (sets UPDATE_FIXTURES=1).
 */

import { mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { expect, test } from "vitest";
import { PlainTextAssembler } from "../../src/assemblers/plainText.js";
import { buildSampleAbstractDay, loadSampleRepo } from "../helpers/buildSampleDay.js";
import { normalizeLf } from "../helpers/normalizeLf.js";
import { fixturesDir } from "../helpers/paths.js";

const fixtureName = "plain-2026-05-10-general.txt";

test("plain text day matches fixture", async () => {
  const repo = await loadSampleRepo();
  const abs = buildSampleAbstractDay();
  const text = normalizeLf(new PlainTextAssembler().assembleDay(abs, repo));
  const fixturePath = path.join(fixturesDir, fixtureName);

  if (process.env.UPDATE_FIXTURES === "1") {
    mkdirSync(fixturesDir, { recursive: true });
    writeFileSync(fixturePath, text, "utf-8");
  }

  const expected = normalizeLf(readFileSync(fixturePath, "utf-8"));
  expect(text).toBe(expected);
});
