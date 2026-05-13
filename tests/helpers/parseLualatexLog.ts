import { normalizeLf } from "./normalizeLf.js";

export type LualatexLogScan = {
  /** TeX / LaTeX error blocks (multi-line where applicable). */
  errors: string[];
  /** Single-line warning messages from the final pass of the log. */
  warnings: string[];
};

/**
 * Scan a `.log` from LuaLaTeX / LaTeX for hard errors and common warning patterns.
 * Heuristic only: relies on standard log prefixes, not a full TeX parser.
 */
export function parseLualatexLog(rawLog: string): LualatexLogScan {
  const log = normalizeLf(rawLog);
  const lines = log.split("\n");
  const errors: string[] = [];
  const warnings: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";

    if (line.startsWith("! ")) {
      errors.push(collectErrorBlock(lines, i));
      continue;
    }

    if (/Emergency stop/.test(line)) {
      errors.push(line.trimEnd());
      continue;
    }

    if (/Fatal error occurred|==>\s*Fatal error/i.test(line)) {
      errors.push(line.trimEnd());
      continue;
    }

    const trimmed = line.trimEnd();
    if (isWarningLine(trimmed)) {
      warnings.push(trimmed);
    }
  }

  return {
    errors: dedupeStrings(errors),
    warnings: dedupeStrings(warnings),
  };
}

function isWarningLine(line: string): boolean {
  return (
    /^LaTeX Warning:/.test(line) ||
    /^LaTeX Font Warning:/.test(line) ||
    /^LaTeX hooks Warning:/.test(line) ||
    /^Package .+ Warning:/.test(line) ||
    /^Class .+ Warning:/.test(line) ||
    /^Module .+ Warning:/.test(line) ||
    /^luaotfload\s+\|?\s*warning:?/i.test(line) ||
    /^Underfull \\hbox/.test(line) ||
    /^Overfull \\hbox/.test(line)
  );
}

function collectErrorBlock(lines: string[], start: number): string {
  const parts: string[] = [];
  const max = Math.min(start + 25, lines.length);
  for (let i = start; i < max; i++) {
    const line = lines[i] ?? "";
    parts.push(line);
    if (i > start && /^l\.[0-9]+/.test(line)) {
      break;
    }
  }
  return parts.join("\n");
}

function dedupeStrings(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of items) {
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

/** Split hbox noise from other warnings for clearer test output. */
export function partitionHboxWarnings(warnings: string[]): {
  hbox: string[];
  other: string[];
} {
  const hbox: string[] = [];
  const other: string[] = [];
  for (const w of warnings) {
    if (/^Underfull \\hbox|^Overfull \\hbox/.test(w)) {
      hbox.push(w);
    } else {
      other.push(w);
    }
  }
  return { hbox, other };
}
