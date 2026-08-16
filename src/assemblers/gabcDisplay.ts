/**
 * Reassemble split GABC into the presentation form the printed books use.
 *
 * Storage keeps a dialogue or short responsory as named sections so a locale
 * can transcribe them independently. Display wants one score: openings and
 * closings as a single block with ℣./℟. labels (Recitationsmelodier p. 1 and
 * last page), and the short responsory as R. / V.+repeat / V. Gloria + full R.
 */

import type { DialogueMelody, ShortResponsoryMelody } from "../types/texts.js";
import {
  joinGabc,
  joinGloriaWithResponse,
  joinResponseHalves,
  joinVerseWithRepeat,
  type GabcAttach,
  type GabcPrefix,
  type GabcSegment,
} from "../tools/gabcJoin.js";

export type DialoguePrefix = GabcPrefix;

export interface DialoguePartSpec {
  key: keyof DialogueMelody;
  prefix?: DialoguePrefix;
  /** How this part attaches to the previous one. Default `line`. */
  attach?: GabcAttach;
}

/** Opening of hours other than the first: V. / R. stacked, then V.+R. Gloria. */
export const INTRO_VERSE_PARTS: readonly DialoguePartSpec[] = [
  { key: "versicle", prefix: "V" },
  { key: "response", prefix: "R", attach: "line" },
  { key: "gloria", prefix: "VR", attach: "line" },
  { key: "alleluia", attach: "inline" },
];

/** First hour of the day: V. and R. on one staff (Recitationsmelodier p. 1). */
export const INVITATORY_VERSE_PARTS: readonly DialoguePartSpec[] = [
  { key: "versicle", prefix: "V" },
  { key: "response", prefix: "R", attach: "inline" },
];

/** OoR / daytime closing: V. and R. on one staff (Recitationsmelodier last page). */
export const OOR_ACCLAMATION_PARTS: readonly DialoguePartSpec[] = INVITATORY_VERSE_PARTS;

/** Compline blessing: V. formula, then R. Amen on the next staff. */
export const COMPLINE_BLESSING_PARTS: readonly DialoguePartSpec[] = [
  { key: "versicle", prefix: "V" },
  { key: "response", prefix: "R", attach: "line" },
];

/** Simpler blessing (no priest): formula, then R. Amen on the same staff. */
export const DISMISSAL_PARTS: readonly DialoguePartSpec[] = [
  { key: "blessing" },
  { key: "amen", prefix: "R", attach: "inline" },
];

/** Through-sung prayer (Our Father): a single `gabc` body, unchanged. */
export const PRAYER_PARTS: readonly DialoguePartSpec[] = [
  { key: "gabc" },
];

export function assembleDialogueGabc(
  melody: DialogueMelody,
  specs: readonly DialoguePartSpec[],
): string {
  const segs: GabcSegment[] = [];
  for (const spec of specs) {
    const raw = melody[spec.key];
    if (typeof raw !== "string" || !raw.trim()) continue;
    segs.push({
      gabc: raw,
      ...(spec.prefix ? { prefix: spec.prefix } : {}),
      ...(spec.attach ? { attach: spec.attach } : {}),
    });
  }
  return joinGabc(segs);
}

/**
 * Presentation form of a short responsory (data-structure.md §2, GILH 49):
 *
 *   ℟. first half + second half
 *   ℣. versicle + second half
 *   ℣. Gloria Patri  ℟. first half + second half
 *
 * The books cue the last ℟.; we write the full response out.
 */
export function assembleShortResponsoryGabc(
  melody: ShortResponsoryMelody,
): string {
  const response = joinResponseHalves(melody.responsory, melody.responsorySecond);
  const verse = joinVerseWithRepeat(melody.versicle, melody.responsorySecond);
  const gloria = joinGloriaWithResponse(melody.gloria, response);

  const segs: GabcSegment[] = [];
  if (response) segs.push({ gabc: response, prefix: "R" });
  if (verse) segs.push({ gabc: verse, prefix: "V", attach: "line" });
  if (gloria) segs.push({ gabc: gloria, prefix: "V", attach: "line" });
  return joinGabc(segs);
}
