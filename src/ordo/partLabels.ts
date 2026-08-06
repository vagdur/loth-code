import type { OrdoLabels } from "../types/texts.js";

/**
 * Part label for an ordo slot key, in the locale's own words (shared by the
 * hour summarizer and the option notes).
 */
export function partLabelForSlotKey(slotKey: string, labels: OrdoLabels): string | null {
  const p = labels.parts;
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
