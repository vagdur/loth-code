/**
 * LaTeX assembly for Ordo calendar summaries.
 */

import { escapeTexPlain } from "./texEscape.js";
import type { DataRepository } from "../data/repository.js";
import { getOrdoLabels } from "../ordo/labels.js";
import type { OrdoDaySummary } from "../ordo/summarizeDay.js";

export function wrapOrdoDocument(title: string, body: string): string {
  return `\\documentclass[11pt]{article}
\\usepackage{ordo}
\\begin{document}
\\ordoTitle{${escapeTexPlain(title)}}

${body}
\\end{document}
`;
}

export function assembleOrdoDayTex(day: OrdoDaySummary): string {
  const lines: string[] = [];
  const hourBlocks = day.hours
    .map((h) => `\\ordoHour{${escapeTexPlain(h.label)}}{${escapeTexPlain(h.prose)}}`)
    .join("\n");
  const options = day.celebrationOptions
    ? `\\ordoOptions{${escapeTexPlain(day.celebrationOptions)}}\n`
    : "";
  lines.push(
    `\\ordoDay{${escapeTexPlain(day.headline)}}{${options}${hourBlocks}}`,
  );
  return lines.join("\n");
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
