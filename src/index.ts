/**
 * The package's default entry point, and everything a host needs to turn a
 * date into markup.
 *
 * Nothing reachable from here touches `fs`, `path`, `child_process` or any
 * other Node built-in — that is what makes the package usable from a
 * Cloudflare Worker, and `npm run check:worker-safe` enforces it by bundling
 * this file for a browser target and failing if a built-in appears.
 *
 * The Node-only half — reading the YAML tree, locating exsurge's assets,
 * driving lualatex — lives behind the `./node` entry point instead.
 *
 * A host that cannot read the data tree gets a repository and a registry from
 * `fromBundle`, using bundles produced at publish time by `./node`.
 */

// --- Data -----------------------------------------------------------------
export { DataRepository, psalterKey } from "./data/repository.js";
export {
  collectMelodyOptions,
  hydrateMelodies,
  matchesCondition,
  resolveAllMelodies,
  selectMelodyRef,
} from "./data/melodyResolver.js";
export type { RegistryBundle, RepoBundle } from "./types/bundle.js";

// --- Layer 1: the calendar ------------------------------------------------
export {
  defaultContext,
  enumerateDayCelebrationAlternatives,
  resolveDay,
} from "./calendar/index.js";
export { utcDate } from "./calendar/computus.js";
export {
  SanctoralCalendarRegistry,
  compileToCalendarSaint,
  nominalDateFromEntry,
} from "./calendar/sanctoralRegistry.js";
export {
  getSaintsOnDate,
  getSanctoralRegistry,
  getSeasonalObservance,
  initSanctoralRegistry,
  withSanctoralRegistry,
} from "./calendar/saints.js";
export { getSeasonalDayKey } from "./calendar/liturgicalYear.js";
export { addDays } from "./calendar/computus.js";

// --- Layer 2: the abstract hours ------------------------------------------
export {
  buildDay,
  defaultCurrentDaytimeHour,
  eveningVespers,
} from "./hours/index.js";

// --- Layer 3: the assemblers ----------------------------------------------
export { HtmlAssembler } from "./assemblers/htmlAssembler.js";
/**
 * The document tree HtmlAssembler produces. A host that renders this itself
 * gets each score as data rather than as markup to be found afterwards;
 * `renderHtml` is the same output as a string, for the static path.
 */
export { collectScores, renderHtml } from "./assemblers/tree.js";
export type {
  AssembledHour,
  LothElement,
  LothFragment,
  LothNode,
  LothScoreNode,
  LothText,
  ScoreSpec,
} from "./assemblers/tree.js";
export { PlainTextAssembler } from "./assemblers/plainText.js";
export { TexAssembler } from "./assemblers/texAssembler.js";
export { assembleOrdoDocument } from "./assemblers/ordoTex.js";
export {
  resolvePsalmAssignment,
  resolveSource,
} from "./assemblers/types.js";
export type { Assembler, ResolveOptions } from "./assemblers/types.js";
export {
  PSALM_UNASSIGNED,
  resolvePsalmText,
} from "./assemblers/liturgicalText.js";

// --- Options and ordo -----------------------------------------------------
export * from "./options/index.js";
export * from "./ordo/index.js";

// --- Types ----------------------------------------------------------------
export type * from "./types/index.js";
export type * from "./types/options.js";
export type * from "./types/seasonalObservance.js";
