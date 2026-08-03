/**
 * Reading and comparing the GABC held in a KLN melody entry.
 *
 * A port of the read half of `scripts/kln_gabc_store.py`, for hosts that
 * review transcriptions rather than produce them. The write half —
 * `apply_working_gabc`, `apply_transcriber_snapshot`,
 * `mirror_gabc_to_transcriber` — stays in Python, because only the
 * transcription pipeline calls it and that pipeline is not moving.
 *
 * Python therefore remains the source of truth for what these functions mean.
 * `npm run check:kln-parity` runs both implementations over the whole tracked
 * corpus and fails on any disagreement, which is what keeps two
 * implementations of the same thing honest.
 */

import type { ComparisonUnit, GabcParts, GabcSource, KlnMelody } from "./types.js";

/** Section key standing for "the whole piece", used when there are no parts. */
export const VEC_PART_KEY = "_vec";

function sectionsFromFields(
  vec: string | null | undefined,
  parts: GabcParts | null | undefined,
): GabcParts {
  if (parts && typeof parts === "object") {
    const cleaned: GabcParts = {};
    for (const [key, value] of Object.entries(parts)) {
      const trimmed = (value ?? "").trim();
      if (trimmed) cleaned[key] = trimmed;
    }
    // Parts win whenever any survive trimming; an empty parts object falls
    // through to the unsplit text rather than reporting "no GABC".
    if (Object.keys(cleaned).length > 0) return cleaned;
  }
  const vecText = (vec ?? "").trim();
  return vecText ? { [VEC_PART_KEY]: vecText } : {};
}

/** The named GABC sections of a melody, from whichever side you ask for. */
export function gabcSections(melody: KlnMelody, source: GabcSource): GabcParts {
  return source === "transcriber"
    ? sectionsFromFields(melody.transcriber_gabc_vec, melody.transcriber_gabc_parts)
    : sectionsFromFields(melody.gabc_vec, melody.gabc_parts);
}

export function hasTranscriberSnapshot(melody: KlnMelody): boolean {
  return Object.keys(gabcSections(melody, "transcriber")).length > 0;
}

/**
 * Approved sections paired with the transcriber's version of each.
 *
 * Driven by the approved side: a section the transcriber invented but nobody
 * approved is not something to re-review. A missing counterpart is an empty
 * string rather than an omission, so it shows up as a difference.
 */
export function comparisonUnits(melody: KlnMelody): ComparisonUnit[] {
  const approved = gabcSections(melody, "approved");
  const produced = gabcSections(melody, "transcriber");
  const units: ComparisonUnit[] = [];
  for (const [partKey, text] of Object.entries(approved)) {
    if (text) units.push({ partKey, approved: text, transcriber: produced[partKey] ?? "" });
  }
  return units;
}

export function sectionsDiffer(approved: string, transcriber: string): boolean {
  return (approved ?? "").trim() !== (transcriber ?? "").trim();
}

/** True when a human-approved melody no longer matches what the pipeline produces. */
export function melodyDiffersFromTranscriber(melody: KlnMelody): boolean {
  if (melody.manual_status !== "approved") return false;
  if (!hasTranscriberSnapshot(melody)) return false;
  return comparisonUnits(melody).some((u) => sectionsDiffer(u.approved, u.transcriber));
}

/**
 * Approved, diverged from the transcriber, and not yet looked at again.
 *
 * `force` re-offers melodies already re-reviewed — for when the transcriber
 * has changed enough that an earlier judgement is worth revisiting.
 */
export function melodyNeedsRereview(melody: KlnMelody, force = false): boolean {
  if (!melodyDiffersFromTranscriber(melody)) return false;
  return force ? true : !melody.rereviewed_at;
}

/** Only the sections that actually differ. */
export function differingSections(melody: KlnMelody): ComparisonUnit[] {
  return comparisonUnits(melody).filter((u) => sectionsDiffer(u.approved, u.transcriber));
}

export function partKeyLabel(partKey: string): string {
  return partKey === VEC_PART_KEY ? "hymn" : partKey.replace(/_/g, " ");
}

/**
 * Split GABC for display in a diff, keeping whitespace runs as their own
 * tokens so a spacing-only change is visible rather than invisible.
 *
 * The Python counterpart goes on to build an HTML table with
 * `difflib.HtmlDiff`. That is presentation, and a React host renders it far
 * better than a ported table generator would, so only the tokenizer — the part
 * that decides what counts as a difference — is shared.
 */
export function gabcDiffTokens(text: string): string[] {
  if (!text) return [""];
  return text.split(/(\s+)/).filter((token) => token !== "");
}
