/**
 * Smoke test — build a day and assemble it as plain text.
 * Run:  node dist/smoke.js
 */

import path from "path";
import { fileURLToPath } from "url";
import { DataRepository } from "./data/repository.js";
import { resolveDay, defaultContext } from "./calendar/index.js";
import { buildDay } from "./hours/index.js";
import { PlainTextAssembler } from "./assemblers/plainText.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, "..", "data");

const repo  = await DataRepository.load(dataDir);
const date  = new Date("2026-05-10T00:00:00Z");  // 6th Sunday of Eastertide, Week II
const day   = resolveDay(date, "general");
const ctx   = defaultContext();
const abs   = buildDay(day, ctx);
const text  = new PlainTextAssembler().assembleDay(abs, repo);

console.log(text);
