/**
 * Shared invitatory resolution for the hour assemblers.
 *
 * office-spec §3.1 / GILH 34–36: verse, then Psalm 94 (or substitute) with its
 * antiphon. Print form matches ordinary psalmody (antiphon — psalm — antiphon);
 * sung responsorial repetition after each verse is a performance practice.
 */

import type { DataRepository } from "../data/repository.js";
import type { AbstractInvitatory } from "../types/hours.js";
import type { LiturgicalDay } from "../types/calendar.js";
import type { DayChoices } from "../types/options.js";
import type { Psalm, PsalmAssignment } from "../types/texts.js";
import { slotPath } from "../options/slotTable.js";
import {
  resolveAntiphon, resolveSource, type ResolveOptions,
} from "./types.js";
import { resolvePsalmText } from "./liturgicalText.js";

/** Per-slot ResolveOptions for invitatory slots (mirrors assembler slotOpts). */
export function invitatorySlotOpts(
  choices: DayChoices | undefined,
  slotKey: string,
): ResolveOptions {
  return {
    ...(choices ? { choices } : {}),
    optionPath: slotPath("invitatory", slotKey),
  };
}

/**
 * Resolve the invitatory psalm + antiphon to a PsalmAssignment suitable for
 * the existing psalmody renderers, plus the psalm text body.
 */
export function resolveInvitatoryPsalmody(
  invitatory: AbstractInvitatory,
  repo: DataRepository,
  day: LiturgicalDay,
  choices?: DayChoices,
): { assignment: PsalmAssignment; psalmText: string } | undefined {
  const antiphon = resolveAntiphon(
    invitatory.antiphonRef,
    repo,
    day,
    invitatorySlotOpts(choices, "antiphon"),
  );
  if (!antiphon) return undefined;

  const psalmOpts = invitatorySlotOpts(choices, "psalm");
  let psalmId: string | undefined;
  if (invitatory.psalmRef.kind === "psalm" || invitatory.psalmRef.kind === "canticle") {
    psalmId = invitatory.psalmRef.id;
  } else {
    const resolved = resolveSource(invitatory.psalmRef, repo, day, psalmOpts) as
      | Psalm
      | undefined;
    psalmId = resolved?.id;
  }
  if (!psalmId) return undefined;

  return {
    assignment: { psalmOrCanticleId: psalmId, antiphon },
    psalmText: resolvePsalmText(psalmId, repo),
  };
}
