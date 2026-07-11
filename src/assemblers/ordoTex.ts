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

\\tableofcontents
\\newpage

${body}
\\end{document}
`;
}

function monthSectionKey(date: Date): string {
  return `${date.getUTCFullYear()}-${date.getUTCMonth()}`;
}

function formatMonthSection(date: Date, months: string[]): string {
  const month = months[date.getUTCMonth()] ?? "";
  const title = month.charAt(0).toUpperCase() + month.slice(1);
  return `${title} ${date.getUTCFullYear()}`;
}

function assembleOrdoBody(summaries: OrdoDaySummary[], months: string[]): string {
  const parts: string[] = [];
  let currentKey: string | null = null;

  for (const day of summaries) {
    const key = monthSectionKey(day.date);
    if (key !== currentKey) {
      parts.push(`\\section{${escapeTexPlain(formatMonthSection(day.date, months))}}`);
      currentKey = key;
    }
    parts.push(assembleOrdoDayTex(day));
  }

  return parts.join("\n\n");
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
  if (day.memoriaBlocks && day.memoriaBlocks.length > 0) {
    for (const block of day.memoriaBlocks) {
      const memoriaParts: string[] = [];
      if (block.communeLine) {
        memoriaParts.push(`\\ordoCommune{${escapeTexPlain(block.communeLine)}}`);
      }
      memoriaParts.push(formatHourBlocks(block.hours));
      bodyParts.push(
        `\\ordoMemoriaBlock{${escapeTexPlain(block.heading)}}{${memoriaParts.join("\n")}}`,
      );
    }
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
  const body = assembleOrdoBody(summaries, labels.months);
  return wrapOrdoDocument(docTitle, body);
}
