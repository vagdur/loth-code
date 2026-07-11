import type { DataRepository } from "../data/repository.js";
import type { OrdoLabels } from "../types/texts.js";

export function getOrdoLabels(repo: DataRepository): OrdoLabels {
  const labels = repo.getAssemblerLabels().ordo;
  if (!labels) {
    throw new Error(
      `Ordo labels missing for locale "${repo.locale}" (fixed_texts.yaml labels.ordo)`,
    );
  }
  return labels;
}
