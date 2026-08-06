import type { SlotSourceDirect } from "../types/hours.js";
import type { OrdoLabels } from "../types/texts.js";

/**
 * Part label for an ordo slot key, in the locale's own words (shared by the
 * hour summarizer and the option notes).
 *
 * `winner` is the source the slot actually resolved to, where that changes
 * which part is being named: a psalmody slot normally contributes its
 * antiphon, but one the rubrics fix by psalm carries no antiphon at all.
 */
export function partLabelForSlotKey(
  slotKey: string,
  labels: OrdoLabels,
  winner?: SlotSourceDirect,
): string | null {
  const p = labels.parts;
  if (slotKey.startsWith("psalmSlots") && winner?.kind === "psalmody") return p.psalms;
  if (slotKey === "hymn") return p.hymn;
  if (slotKey.startsWith("psalmSlots")) return p.antiphons;
  if (slotKey === "shortReading") return p.shortReading;
  if (slotKey === "shortResponsory") return p.responsory;
  if (slotKey === "benedictusAntiphon") return p.benedictusAntiphon;
  if (slotKey === "magnificatAntiphon") return p.magnificatAntiphon;
  if (slotKey === "nuncDimittisAntiphon") return p.nuncDimittisAntiphon;
  if (slotKey === "concludingPrayer") return p.concludingPrayer;
  if (slotKey === "intercessions") return p.intercessions;
  if (slotKey === "biblicalReading") return p.firstReading;
  if (slotKey === "patristicReading") return p.secondReading;
  if (slotKey === "versicle") return p.versicle;
  if (slotKey === "properAntiphons") return p.antiphons;
  if (slotKey === "antiphon") return p.invitatoryAntiphon;
  if (slotKey === "psalm") return p.invitatoryPsalm;
  if (slotKey === "marianAntiphon") return p.marianAntiphon;
  if (slotKey.startsWith("memoriaAddendum")) return p.memoriaAddendum;
  return null;
}
