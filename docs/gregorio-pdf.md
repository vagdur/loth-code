# LaTeX / Gregorio PDF output (Lauds)

The [`LaudsTexAssembler`](../src/assemblers/laudsTex.ts) builds a single UTF-8 `.tex` file for **Morning Prayer (Lauds)**. GABC from the data model (`Melody.gabc`, `Antiphon.psalmTone`, canticle melodies) is embedded with the LaTeX `filecontents` environment so Gregorio can read sibling `.gabc` files when you run **LuaLaTeX**.

`npm run build` does **not** require TeX. Producing a PDF is optional and needs a working **LuaLaTeX** installation plus **Gregorio** (GregorioTeX).

## Integration tests (LaTeX + PDF)

From the repository root, `npm test` runs Vitest integration tests. One of them assembles the sample Lauds `.tex` into a temporary directory and runs **LuaLaTeX** twice there (same pattern as before for stable references).

Golden `.tex` and a reference `.pdf` for the sample day live under [`tests/fixtures/`](../tests/fixtures/) (for example `lauds-2026-05-10-general.tex` and `lauds-2026-05-10-general.pdf`). The test suite compares the generated TeX to the fixture text; it does **not** byte-compare PDFs, but when you refresh goldens you can commit an updated PDF for human review.

To rewrite the TeX fixture and copy a freshly built PDF into `tests/fixtures/`:

```powershell
npm run test:fixtures:update
```

That requires LuaLaTeX + Gregorio on `PATH`, same as a normal `npm test` on a machine that runs the compile test.

## Install LuaLaTeX + Gregorio (Windows)

1. Install a TeX distribution that includes **LuaLaTeX**, for example [MiKTeX](https://miktex.org/) or [TeX Live](https://tug.org/texlive/).
2. Install **Gregorio** for your distribution and ensure `gregorio.exe` and GregorioTeX files are on the search path used by MiKTeX/TeX Live. Follow the [Gregorio installation guide](https://gregorio-project.github.io/installation.html) for Windows.
3. Open a **new** PowerShell window so `PATH` picks up the TeX binaries, then check:

   ```powershell
   lualatex --version
   ```

4. If `--compile` fails with missing `gregoriotex` or Gregorio errors, update TeX packages (MiKTeX Package Manager / `tlmgr`) until `\usepackage{gregoriotex}` resolves.

## Notes

- The plain-text placeholder `[Benedictus text — Lk 1:68-79]` matches [`PlainTextAssembler`](../src/assemblers/plainText.ts) until the Gospel canticle text is wired into data.
- GABC is written literally into `filecontents` blocks; avoid placing the substring `\end{filecontents}` inside real GABC sources.
- CI or machines without TeX cannot pass `npm test` as long as the Lauds compile integration test is enabled; use a TeX-capable runner or adjust that test for your pipeline.
