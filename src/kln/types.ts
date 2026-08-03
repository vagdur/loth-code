/**
 * The shape of a KLN melody entry, as far as the review loop cares.
 *
 * Structural rather than exhaustive: `raw_data/kln/split/**\/index.json`
 * carries a good deal more (crop boxes, transcription diagnostics, confidence
 * scores), all of which exists to improve the transcriber rather than to
 * review its output. A host that only reviews never needs to see it, so the
 * type does not describe it.
 */

/** GABC for one named section, or for a whole unsplit piece. */
export type GabcParts = Record<string, string>;

/**
 * Which GABC to read.
 *
 * - `approved`  — the working text, edited by a reviewer
 * - `transcriber` — the pipeline's own last output, never edited by hand
 */
export type GabcSource = "approved" | "transcriber";

export type ManualStatus =
  | "approved"
  | "failed"
  /** Written by the splitter, never by a reviewer. */
  | "failed-auto"
  | "duplicate"
  | null;

export interface KlnMelody {
  gabc_vec?: string | null;
  gabc_parts?: GabcParts | null;
  transcriber_gabc_vec?: string | null;
  transcriber_gabc_parts?: GabcParts | null;
  manual_status?: ManualStatus;
  rereviewed_at?: string | null;
  [key: string]: unknown;
}

/** One section, paired with what the transcriber produced for it. */
export interface ComparisonUnit {
  partKey: string;
  approved: string;
  transcriber: string;
}
