/**
 * Transfer rules for sanctoral solemnities (GNLY 60 and calendar-specific rubrics).
 * Referenced from calendar YAML via transfer_rule keys.
 */

import { addDays, easterSunday, palmSunday } from "./computus.js";

export type TransferRuleFn = (nominal: Date, year: number) => Date;

/**
 * Annunciation of the Lord — GNLY 60:
 *   1. If 25 March falls within Holy Week or the Easter Octave, transfer to
 *      the Monday after the Second Sunday of Easter.
 *   2. If 25 March falls on a Sunday of Lent (other than Palm Sunday),
 *      transfer to the following Monday.
 *   3. Otherwise kept on 25 March.
 */
export const annunciationGnly60: TransferRuleFn = (nominal, year) => {
  const palm = palmSunday(year);
  const easter = easterSunday(year);
  const secondSundayOfEaster = addDays(easter, 7);
  if (nominal >= palm && nominal <= secondSundayOfEaster) {
    return addDays(secondSundayOfEaster, 1);
  }
  if (nominal.getUTCDay() === 0) {
    return addDays(nominal, 1);
  }
  return nominal;
};

export const TRANSFER_RULES: Record<string, TransferRuleFn> = {
  annunciation_gnly60: annunciationGnly60,
};

export function applyTransferRule(
  ruleKey: string,
  nominal: Date,
  year: number,
): Date {
  const rule = TRANSFER_RULES[ruleKey];
  if (!rule) {
    throw new Error(`Unknown sanctoral transfer rule: ${ruleKey}`);
  }
  return rule(nominal, year);
}
