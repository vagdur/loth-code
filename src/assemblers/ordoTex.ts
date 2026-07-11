/**
 * LaTeX assembly for Ordo calendar summaries.
 */

import { escapeTexPlain } from "./texEscape.js";
import type { DataRepository } from "../data/repository.js";
import { getOrdoLabels } from "../ordo/labels.js";
import type { OrdoDaySummary, OrdoHourSummary } from "../ordo/summarizeDay.js";

export function wrapOrdoDocument(title: string, body: string): string {
  return `\\documentclass[11pt]{article}
\\usepackage{ordo}
\\begin{document}
\\ordoTitle{${escapeTexPlain(title)}}

${body}
\\end{document}
`;
}

function formatHourBlocks(hours: OrdoHourSummary[]): string {
  return hours
    .map((h) => `\\ordoHour{${escapeTexPlain(h.label)}}{${escapeTexPlain(h.prose)}}`)
    .join("\n");
}

export function assembleOrdoDayTex(day: OrdoDaySummary): string {
  const bodyParts: string[] = [];

  if (day.communeLine) {
    bodyParts.push(`\\ordoCommune{${escapeTexPlain(day.communeLine)}}`);
  }
  if (day.celebrationOptions) {
    bodyParts.push(`\\ordoOptions{${escapeTexPlain(day.celebrationOptions)}}`);
  }
  if (day.defaultBody) {
    bodyParts.push(`\\ordoDefault{${escapeTexPlain(day.defaultBody)}}`);
  }
  if (day.hours.length > 0) {
    bodyParts.push(formatHourBlocks(day.hours));
  }
  if (day.memoriaIfCelebrated && day.memoriaIfCelebrated.length > 0) {
    const memoriaParts: string[] = [];
    if (day.memoriaCommuneLine) {
      memoriaParts.push(`\\ordoCommune{${escapeTexPlain(day.memoriaCommuneLine)}}`);
    }
    memoriaParts.push(formatHourBlocks(day.memoriaIfCelebrated));
    bodyParts.push(
      `\\ordoMemoriaBlock{${memoriaParts.join("\n")}}`,
    );
  }

  const body = bodyParts.join("\n");
  return `\\ordoDay{${escapeTexPlain(day.headline)}}{${escapeTexPlain(day.psalterWeekLine)}}{${body}}`;
}

export function assembleOrdoDocument(
  summaries: OrdoDaySummary[],
  repo: DataRepository,
  title?: string,
): string {
  const labels = getOrdoLabels(repo);
  const docTitle =
    title ??
    (labels.documentTitle ?? "Ordo").replace("{year}", "2025/2026");
  const body = summaries.map(assembleOrdoDayTex).join("\n\n");
  return wrapOrdoDocument(docTitle, body);
}
