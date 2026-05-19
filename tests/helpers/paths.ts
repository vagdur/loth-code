import path from "path";
import { fileURLToPath } from "url";

/** Repository root (contains `data/`, `src/`, `tests/`). */
export const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

/** Root of locale bundles (`data/en/`, `data/nl/`, …). */
export const dataRoot = path.join(repoRoot, "data");

export const defaultLocale = "en";

/** Default locale bundle path (direct file access in tests/scripts). */
export const dataDir = path.join(dataRoot, defaultLocale);

export const fixturesDir = path.join(repoRoot, "tests", "fixtures");
