import type { OrdoLabels } from "../types/texts.js";
import type { PsalterWeek } from "../types/psalter.js";

const PSALTER_WEEK_ROMAN: Record<PsalterWeek, string> = {
  1: "I",
  2: "II",
  3: "III",
  4: "IV",
};

export function psalterWeekRoman(week: PsalterWeek): string {
  return PSALTER_WEEK_ROMAN[week];
}

export function formatPsalterWeekLine(week: PsalterWeek, labels: OrdoLabels): string {
  const template = labels.prose.psalterWeek ?? "Psalter week {week}";
  return template.replace("{week}", psalterWeekRoman(week));
}
