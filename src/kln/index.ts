/**
 * The KLN chant review loop: reading, comparing and transposing the GABC held
 * in a split melody entry.
 *
 * Deliberately does not include anything that *produces* a transcription.
 * Splitting PDFs, vector transcription, word grouping and metadata derivation
 * all stay in Python, run locally, and write `index.json`; this is only what a
 * host needs to show that output to a human and record what they decide.
 *
 * Worker-safe: no Node built-ins, so it is reachable from the package's
 * default entry point as well as from `@vagdur/loth/kln`.
 */

export {
  VEC_PART_KEY,
  comparisonUnits,
  differingSections,
  gabcDiffTokens,
  gabcSections,
  hasTranscriberSnapshot,
  melodyDiffersFromTranscriber,
  melodyNeedsRereview,
  partKeyLabel,
  sectionsDiffer,
} from "./gabcStore.js";

export {
  META_SCALAR_KEYS,
  emptyMetadata,
  normalizeMetadata,
  sanitizeMetadataPayload,
  type GabcMetadata,
  type MetaScalarKey,
} from "./gabcMetadata.js";

export { transposeGabc } from "./transposeGabc.js";

export type {
  ComparisonUnit,
  GabcParts,
  GabcSource,
  KlnMelody,
  ManualStatus,
} from "./types.js";
