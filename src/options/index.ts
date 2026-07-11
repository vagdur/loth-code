/**
 * Per-day options — enumeration and shared slot addressing.
 */

export { enumerateDayOptions } from "./enumerate.js";
export type { DayOptionsResult } from "./enumerate.js";
export { daySlots, slotPath } from "./slotTable.js";
export type { DaySlot, HourKey } from "./slotTable.js";
export type {
  DayChoices, DayOption, DayOptionKind, OptionChoice,
} from "../types/options.js";
export {
  PSALMODY_COMPLEMENTARY, PSALMODY_CURRENT,
} from "../types/options.js";
