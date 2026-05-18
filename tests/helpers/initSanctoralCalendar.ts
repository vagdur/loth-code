import { SanctoralCalendarRegistry } from "../../src/calendar/sanctoralRegistry.js";
import { initSanctoralRegistry } from "../../src/calendar/saints.js";
import { dataDir } from "./paths.js";

let initialized = false;

/** Load data/calendars/ and register for resolveDay / getSaintsOnDate. */
export async function ensureSanctoralCalendar(): Promise<void> {
  if (initialized) return;
  const registry = await SanctoralCalendarRegistry.load(dataDir);
  initSanctoralRegistry(registry);
  initialized = true;
}
