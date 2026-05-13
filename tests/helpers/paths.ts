import path from "path";
import { fileURLToPath } from "url";

/** Repository root (contains `data/`, `src/`, `tests/`). */
export const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

export const dataDir = path.join(repoRoot, "data");
export const fixturesDir = path.join(repoRoot, "tests", "fixtures");
