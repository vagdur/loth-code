/**
 * Build an AbstractLauds for a given liturgical day and assembly context.
 *
 * Implements the slot resolution rules for Lauds (office-spec §3.2, §5, §9.1).
 * No text data is loaded here — only SlotSource references are constructed.
 */

import type { AssemblyContext, LiturgicalDay } from "../types/calendar.js";
import type { AbstractLauds, PsalmSlot, SlotSource } from "../types/hours.js";

import {
  antiphonRef, concludingPrayerRef, hymnRef, intercessionsRef,
  psalmAssignmentRef, shortReadingRef, SlotContext,
} from "./resolver.js";
import { makeCtx, makeFlags } from "./shared.js";

// ---------------------------------------------------------------------------
// Psalmody
// ---------------------------------------------------------------------------

/**
 * Lauds psalmody = [morning psalm, OT canticle, psalm of praise].
 *
 * On solemnities: Sunday Week I psalmody (GILH 227).
 * On all other days: current psalter.
 * On solemnities and feasts with proper antiphons: proper antiphons overlay
 * the psalter assignment (handled via the antiphonRef inside psalmAssignmentRef).
 *
 * Note: the antiphon is embedded in the PsalmAssignment, so a proper antiphon
 * means fetching the whole PsalmAssignment from the proper rather than the psalter.
 */
function buildPsalmSlots(
  ctx: SlotContext,
  day: LiturgicalDay,
): [PsalmSlot, PsalmSlot, PsalmSlot] {
  const { celebration: c } = ctx;

  // Solemnities use Sunday Week I psalmody for Lauds.
  const usesSundayWeekI =
    c.type === "solemnity" ||
    c.type === "feast_of_lord_on_sunday";

  const psalmCtx: SlotContext = usesSundayWeekI
    ? { ...ctx, psalterWeek: 1, psalterDay: "Sunday" }
    : ctx;

  // Proper antiphons may overlay psalter assignments on feasts/solemnities.
  // We encode the potential proper as the first source in the chain.
  const hasProperAntiphons =
    c.type === "solemnity" ||
    c.type === "feast" ||
    c.type === "feast_of_lord_on_sunday" ||
    // Proper antiphons in privileged seasons (GILH 116); Triduum included:
    (["holy_week", "easter_triduum", "eastertide", "advent", "christmas"].includes(day.season) &&
      c.type !== "ordinary_ferial");

  return [
    { assignmentRef: psalmAssignmentRef(hasProperAntiphons ? ctx : psalmCtx, "lauds.psalmAssignments[0]", hasProperAntiphons) },
    { assignmentRef: psalmAssignmentRef(hasProperAntiphons ? ctx : psalmCtx, "lauds.psalmAssignments[1]", hasProperAntiphons) },
    { assignmentRef: psalmAssignmentRef(hasProperAntiphons ? ctx : psalmCtx, "lauds.psalmAssignments[2]", hasProperAntiphons) },
  ];
}

// ---------------------------------------------------------------------------
// Main builder
// ---------------------------------------------------------------------------

export function buildLauds(
  day: LiturgicalDay,
  context: AssemblyContext,
): AbstractLauds {
  const { celebration: c, psalterWeek, psalterDay } = day;
  const ctx: SlotContext = makeCtx(day);

  const flags = makeFlags(day, false);
  const suppressIntroVerse = context.oorIsFirstHour && context.laudsFollowsOorDirectly;

  const hymn = hymnRef(ctx, "lauds.hymns");
  const psalmSlots = buildPsalmSlots(ctx, day);
  const shortReading = shortReadingRef(ctx, "lauds.shortReading");

  // Short responsory: may be omitted (GILH 49); we always include the ref
  // and leave the decision to the assembler.
  const shortResponsory: SlotSource = (() => {
    if (c.source === "saint" && c.saintId) {
      return {
        kind: "fallback_chain",
        sources: [
          { kind: "saint", id: c.saintId, field: "lauds.shortResponsory" },
          { kind: "psalter", week: psalterWeek, day: psalterDay, field: "lauds.shortResponsory" },
        ],
      };
    }
    if (c.seasonalKey) {
      return {
        kind: "fallback_chain",
        sources: [
          { kind: "seasonal", key: c.seasonalKey, field: "lauds.shortResponsory" },
          { kind: "psalter", week: psalterWeek, day: psalterDay, field: "lauds.shortResponsory" },
        ],
      };
    }
    return { kind: "psalter", week: psalterWeek, day: psalterDay, field: "lauds.shortResponsory" };
  })();

  const benedictuAntiphon = antiphonRef(
    ctx,
    "lauds.benedictuAntiphon",
    "lauds.benedictuAntiphon",
  );

  const intercessions = intercessionsRef(ctx, "lauds.intercessions");
  const concludingPrayer = concludingPrayerRef(ctx, "lauds");

  // Privileged-season memoria addendum (office-spec §9.2 / GILH 239b).
  const memoriaAddendum =
    c.allowMemoriaAddendum && c.saintId
      ? {
          antiphonRef: { kind: "saint" as const, id: c.saintId, field: "lauds.benedictuAntiphon" },
          concludingPrayerRef: { kind: "saint" as const, id: c.saintId, field: "lauds.concludingPrayer" },
        }
      : undefined;

  return {
    kind: "lauds",
    liturgicalDay: day,
    flags,
    suppressIntroVerse,
    hymnRef: hymn,
    psalmSlots,
    shortReadingRef: shortReading,
    shortResponsoryRef: shortResponsory,
    benedictuAntiphonRef: benedictuAntiphon,
    intercessionsRef: intercessions,
    concludingPrayerRef: concludingPrayer,
    ...(memoriaAddendum ? { memoriaAddendum } : {}),
  };
}
