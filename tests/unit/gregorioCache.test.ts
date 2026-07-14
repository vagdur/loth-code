import { createHash } from "crypto";
import { describe, expect, it } from "vitest";
import {
  extractFilecontentsGabc,
  gtexRelPath,
  injectCompileGabcMode,
  prepareGregorioCompile,
  scoreRefsFromTex,
} from "../helpers/gregorioCache.js";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import os from "os";
import path from "path";

function hash(content: string): string {
  return createHash("sha256").update(content).digest("hex").slice(0, 16);
}

describe("gregorioCache", () => {
  it("extracts filecontents gabc and score refs", () => {
    const tex = String.raw`\begin{filecontents}[overwrite,noheader]{a.gabc}
name:a;
%%
(c4) hi(g)
\end{filecontents}

\documentclass{article}
\usepackage{loth}
\begin{document}
\lothScore{a}
\end{document}`;

    const { texWithout, gabc } = extractFilecontentsGabc(tex);
    expect(gabc.get("a.gabc")).toContain("name:a;");
    expect(texWithout).not.toContain("filecontents");
    expect(scoreRefsFromTex(texWithout)).toEqual(["a"]);
    expect(injectCompileGabcMode(texWithout, "never")).toContain("\\gresetcompilegabc{never}");
    expect(gtexRelPath("a", "6_1_0")).toBe(path.join("tmp-gre", "a-6_1_0.gtex"));
  });

  it("prepareGregorioCompile reports cache hit when manifest matches", () => {
    const jobDir = mkdtempSync(path.join(os.tmpdir(), "loth-gre-cache-"));
    const cacheDir = mkdtempSync(path.join(os.tmpdir(), "loth-gre-store-"));
    try {
      const gabcBody = "name:score;\n%%\n(c4) hi(g)\n";
      const tex = `\\documentclass{article}
\\usepackage{loth}
\\begin{document}
\\lothScore{score}
\\end{document}`;

      writeFileSync(path.join(jobDir, "score.gabc"), gabcBody, "utf-8");
      mkdirSync(path.join(cacheDir, "tmp-gre"), { recursive: true });
      writeFileSync(path.join(cacheDir, "tmp-gre", "score-6_1_0.gtex"), "% cached\n", "utf-8");
      writeFileSync(
        path.join(cacheDir, "manifest.json"),
        JSON.stringify({
          gregoriotexVersion: "6.1.0",
          scores: {
            score: { hash: hash(gabcBody), gtex: "tmp-gre/score-6_1_0.gtex" },
          },
        }),
        "utf-8",
      );

      const prepared = prepareGregorioCompile(jobDir, tex, { cacheDir, gabcSourceDir: jobDir });
      expect(prepared.cacheHit).toBe(true);
      expect(readFileSync(path.join(jobDir, "tmp-gre", "score-6_1_0.gtex"), "utf-8")).toContain("cached");
    } finally {
      rmSync(jobDir, { recursive: true, force: true });
      rmSync(cacheDir, { recursive: true, force: true });
    }
  }, 15_000);
});
