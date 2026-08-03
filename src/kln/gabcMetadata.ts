/**
 * The GABC header fields a reviewer can edit, and how to clean up what they
 * submit.
 *
 * Only the *normalising* part of `scripts/kln_gabc_metadata.py` is here.
 * Everything that derives metadata from a transcription — `build_metadata`,
 * `detect_language`, `extract_incipt_name`, `infer_office_part` — stays in
 * Python and runs before a melody is ever seeded, because a reviewer edits
 * metadata rather than regenerating it. `scripts/seed-kln-d1.py` refuses to
 * seed a melody without metadata precisely so this side never has to guess.
 */

/**
 * The scalar header fields, in the order a GABC header writes them.
 *
 * The Flask validator already ships this same tuple to its own page as
 * `META_KEYS`, so the browser has always owned the form; this is that list,
 * typed.
 */
export const META_SCALAR_KEYS = [
  "name",
  "gabc-copyright",
  "score-copyright",
  "office-part",
  "occasion",
  "meter",
  "commentary",
  "arranger",
  "author",
  "date",
  "manuscript",
  "manuscript-reference",
  "manuscript-storage-place",
  "book",
  "language",
  "transcriber",
  "transcription-date",
  "mode",
  "mode-modifier",
  "user-notes",
] as const;

export type MetaScalarKey = (typeof META_SCALAR_KEYS)[number];

export interface GabcMetadata extends Record<string, unknown> {
  annotations: string[];
}

/** Every scalar present and empty, with no annotations. */
export function emptyMetadata(): GabcMetadata {
  const out = { annotations: [] as string[] } as GabcMetadata;
  for (const key of META_SCALAR_KEYS) out[key] = "";
  return out;
}

/**
 * Coerce arbitrary submitted JSON into the canonical shape.
 *
 * Unknown keys are dropped rather than stored: the header serialiser writes a
 * fixed field list, so anything else would be silently carried around for
 * nobody to read. A string `annotations` is accepted as a single annotation,
 * matching the Python behaviour that a form posting one value should not have
 * to know it is a list.
 */
export function normalizeMetadata(raw: unknown): GabcMetadata {
  const base = emptyMetadata();
  if (!raw || typeof raw !== "object") return base;

  const source = raw as Record<string, unknown>;
  for (const key of META_SCALAR_KEYS) {
    const value = source[key];
    if (value !== undefined && value !== null) base[key] = String(value).trim();
  }

  const annotations = source["annotations"];
  if (Array.isArray(annotations)) {
    base.annotations = annotations.map((a) => String(a).trim()).filter((a) => a !== "");
  } else if (typeof annotations === "string" && annotations.trim()) {
    base.annotations = [annotations.trim()];
  }
  return base;
}

/** What to store for a metadata payload submitted by a reviewer. */
export function sanitizeMetadataPayload(raw: unknown): GabcMetadata {
  return normalizeMetadata(raw);
}
