import { beforeAll } from "vitest";
import { ensureSanctoralCalendar } from "./helpers/initSanctoralCalendar.js";

beforeAll(async () => {
  await ensureSanctoralCalendar();
});
