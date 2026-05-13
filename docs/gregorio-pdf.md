# LaTeX / Gregorio PDF output (Lauds)

The [`LaudsTexAssembler`](../src/assemblers/laudsTex.ts) builds a single UTF-8 `.tex` file for **Morning Prayer (Lauds)**. GABC from the data model (`Melody.gabc`, `Antiphon.psalmTone`, canticle melodies) is embedded with the LaTeX `filecontents` environment so Gregorio can read sibling `.gabc` files when you run **LuaLaTeX**.

`npm run build` does **not** require TeX. Producing a PDF is optional and needs a working **LuaLaTeX** installation plus **Gregorio** (GregorioTeX).

## Generate LaTeX

From the repository root:

```powershell
npm run smoke:lauds-tex
```

This writes `out/lauds-build/lauds.tex` (and leaves intermediate `.gabc` creation to the first LuaLaTeX run, via `filecontents`).

To also invoke the compiler:

```powershell
npm run build
node dist/smokeLaudsTex.js --compile
```

That runs `lualatex` twice in `out/lauds-build/` (standard for stable references). The PDF path is `out/lauds-build/lauds.pdf` if the build succeeds.

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
- CI or machines without TeX should only run the TypeScript build and treat PDF compilation as an optional local step.
