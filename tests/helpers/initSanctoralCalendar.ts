import { loadSanctoralRegistry } from "../../src/calendar/sanctoralRegistryNode.js";
import { initSanctoralRegistry } from "../../src/calendar/saints.js";
import { dataRoot, defaultLocale } from "./paths.js";

let initialized = false;

/** Load data/calendars/ and register for resolveDay / getSaintsOnDate. */
export async function ensureSanctoralCalendar(): Promise<void> {
  if (initialized) return;
  const registry = await loadSanctoralRegistry(dataRoot, defaultLocale);
  initSanctoralRegistry(registry);
  initialized = true;
}
