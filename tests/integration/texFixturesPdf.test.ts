/**
 * Compile every golden `.tex` fixture and refresh sibling `.pdf` files for human review.
 * Tests assert on `.tex` only; run this separately when you want updated PDF previews.
 *
 * Requires LuaLaTeX (+ Gregorio for score-bearing fixtures): `npm run test:fixtures:compile-pdf`.
 */

import { readdirSync, readFileSync } from "fs";
import path from "path";
import { describe, test } from "vitest";
import { compileFixturePdf, needsGregorioScores } from "../helpers/compileFixtureTex.js";
import { gregorioAutocompileDiagnosis, gregorioAutocompileWorks } from "../helpers/gregorioAutocompile.js";
import { fixturesDir } from "../helpers/paths.js";

const fixtureTexFiles = readdirSync(fixturesDir)
  .filter((name) => name.endsWith(".tex"))
  .sort();

describe("fixture PDF refresh", () => {
  test.for(fixtureTexFiles)(
    "fixture %s PDF is refreshed from golden TeX",
    async (fixtureName, ctx) => {
      const fixturePath = path.join(fixturesDir, fixtureName);
      const tex = readFileSync(fixturePath, "utf-8");

      if (needsGregorioScores(tex) && !(await gregorioAutocompileWorks())) {
        const diagnosis = gregorioAutocompileDiagnosis();
        if (diagnosis) ctx.skip(diagnosis);
        else ctx.skip("Gregorio auto-compile unavailable");
        return;
      }

      await compileFixturePdf(fixturePath, gregorioAutocompileWorks);
    },
    180_000,
  );
});
