/**
 * Per-day option enumeration — the API a UI uses to show what may be chosen
 * for a given date, and with which defaults.
 *
 * The enumerator is a sibling of the assemblers: it builds the AbstractDay
 * with the choices made so far and walks its slots against the repository,
 * emitting a DayOption wherever a real alternative exists.  Feed the chosen
 * ids back as DayChoices into resolveDay / buildDay / the assemblers.
 *
 * Cascade contract: changing an upstream choice (celebration, a `.source`
 * choice) can change which downstream options exist — re-enumerate after
 * each change.  Appliers ignore stale ids, so an outdated choice set can
 * never produce an invalid office, only default behavior.
 */

import { enumerateDayCelebrationAlternatives, resolveDay } from "../calendar/index.js";
import { buildDay, defaultCurrentDaytimeHour } from "../hours/index.js";
import { resolveSource, sourceChoiceId } from "../assemblers/types.js";
import { getComplineResponsory } from "../assemblers/liturgicalText.js";
import { collectMelodyOptions } from "../data/melodyResolver.js";
import type { DataRepository } from "../data/repository.js";
import type { AssemblyContext } from "../types/calendar.js";
import type { SlotSourceDirect } from "../types/hours.js";
import type { DayChoices, DayOption, OptionChoice } from "../types/options.js";
import { PSALMODY_COMPLEMENTARY, PSALMODY_CURRENT } from "../types/options.js";
import { daySlots, slotPath, type HourKey } from "./slotTable.js";

export interface DayOptionsResult {
  options: DayOption[];
  /** One entry per option: the given choice when valid, else the default. */
  effectiveChoices: DayChoices;
}

type OptionLabels = NonNullable<
  NonNullable<ReturnType<DataRepository["getFixedTexts"]>>["labels"]
>["options"];

function optionLabels(repo: DataRepository): NonNullable<OptionLabels> {
  return repo.getFixedTexts()?.labels?.options ?? {};
}

function sourceLabel(
  s: SlotSourceDirect,
  repo: DataRepository,
  labels: NonNullable<OptionLabels>,
): string {
  switch (s.kind) {
    case "psalter":
      return labels.fromPsalter ?? "From the psalter";
    case "seasonal":
      return labels.fromSeasonal ?? "From the season";
    case "common": {
      const variantLabel = repo.resolve({
        kind: "common", type: s.type, variant: s.variant, field: "label",
      });
      const name = typeof variantLabel === "string" ? variantLabel : s.type;
      return `${labels.fromCommonPrefix ?? "From the common: "}${name}`;
    }
    case "saint":
      return s.id;
    default:
      return sourceChoiceId(s);
  }
}

export function enumerateDayOptions(
  date: Date,
  context: AssemblyContext,
  repo: DataRepository,
  choices?: DayChoices,
): DayOptionsResult {
  const labels = optionLabels(repo);
  const options: DayOption[] = [];

  // 1. Celebration choice (feria / optional memorials / Saturday BVM).
  const alternatives = enumerateDayCelebrationAlternatives(date, context.calendarId);
  if (alternatives.length >= 2) {
    const altLabel = (a: (typeof alternatives)[number]): string => {
      if (a.choiceId === "feria") return labels.feria ?? a.label;
      if (a.choiceId === "bvm_saturday") return labels.bvmSaturday ?? a.label;
      return a.label;
    };
    options.push({
      id: "celebration",
      kind: "celebration",
      label: labels.celebration ?? "Celebration",
      choices: alternatives.map((a) => ({ id: a.choiceId, label: altLabel(a) })),
      defaultChoiceId:
        alternatives.find((a) => a.isDefault)?.choiceId ?? "feria",
    });
  }

  // 2. Build the day with the choices made so far.
  const day = resolveDay(date, context.calendarId, choices);
  const abstractDay = buildDay(day, context, choices);

  // 3. Daytime psalmody: current vs. complementary, per hour said (§3 of
  //    the option contract — cross-hour exclusivity is the caller's concern).
  const defaultCurrent = defaultCurrentDaytimeHour(context.daytimeHoursSaid);
  for (const hour of context.daytimeHoursSaid) {
    options.push({
      id: `${hour}.psalmody`,
      kind: "psalmody",
      label: labels.psalmody ?? "Psalmody",
      choices: [
        { id: PSALMODY_CURRENT, label: labels.currentPsalmody ?? "Current psalmody" },
        { id: PSALMODY_COMPLEMENTARY, label: labels.complementaryPsalmody ?? "Complementary psalmody" },
      ],
      defaultChoiceId:
        defaultCurrent === hour ? PSALMODY_CURRENT : PSALMODY_COMPLEMENTARY,
    });
  }

  // 4. Slot walk: ad-lib source options and melody options.
  for (const slot of daySlots(abstractDay)) {
    const path = slotPath(slot.hourKey, slot.slotKey);
    const src = slot.source;

    if (src.kind === "fallback_chain" && src.adLibFrom !== undefined) {
      const headYields = src.sources
        .slice(0, src.adLibFrom)
        .some((s) => repo.resolve(s) != null);
      if (!headYields) {
        const yielding = src.sources
          .slice(src.adLibFrom)
          .filter((s) => repo.resolve(s) != null);
        if (yielding.length >= 2) {
          const sourceChoices: OptionChoice[] = yielding.map((s) => ({
            id: sourceChoiceId(s),
            label: sourceLabel(s, repo, labels),
          }));
          options.push({
            id: `${path}.source`,
            kind: "part_source",
            label: path,
            choices: sourceChoices,
            defaultChoiceId: sourceChoices[0]!.id,
          });
        }
      }
    }

    // Melody alternatives on the value this slot resolves to (pre-hydration,
    // honoring the source choice so the alternatives match what is rendered).
    const raw = resolveSource(src, repo, undefined, {
      ...(choices ? { choices } : {}),
      optionPath: path,
    });
    if (raw != null) options.push(...collectMelodyOptions(raw, repo, day, path));
  }

  // The fixed Compline responsory carries melody refs outside the slot table.
  const complineResp = getComplineResponsory(repo);
  if (complineResp) {
    options.push(
      ...collectMelodyOptions(complineResp, repo, day, slotPath("compline", "responsory")),
    );
  }

  // Fixed parts (introduction, Our Father, dismissal, ...) also carry melody
  // refs outside the slot table; paths must mirror TexAssembler's blocks.
  const fixed = repo.getFixedTexts();
  if (fixed) {
    const collect = (value: unknown, path: string) =>
      options.push(...collectMelodyOptions(value, repo, day, path));

    const vespersKey: HourKey = abstractDay.vespers.isFirstVespers
      ? "firstVespers"
      : "vespers";
    const daytimeKeys = (["terce", "sext", "none"] as const).filter(
      (k) => abstractDay[k],
    );

    const introHours: HourKey[] = [
      ...(abstractDay.officeOfReadings.isFirstHour ? [] : ["officeOfReadings" as const]),
      ...(abstractDay.lauds.suppressIntroVerse ? [] : ["lauds" as const]),
      ...daytimeKeys,
      vespersKey,
      "compline",
    ];
    for (const hourKey of introHours) {
      collect(fixed.introductoryVerse, slotPath(hourKey, "introVerse"));
    }
    if (abstractDay.officeOfReadings.isFirstHour) {
      collect(fixed.invitatoryVerse, slotPath("invitatory", "verse"));
    }
    for (const hourKey of ["lauds", vespersKey] as const) {
      collect(fixed.lordsPrayer, slotPath(hourKey, "lordsPrayer"));
      collect(fixed.dismissalWithoutMinister, slotPath(hourKey, "dismissal"));
    }
    for (const hourKey of ["officeOfReadings", ...daytimeKeys] as const) {
      collect(fixed.oorAcclamation, slotPath(hourKey, "acclamation"));
    }
    collect(fixed.complineBlessing, slotPath("compline", "blessing"));
  }

  const effectiveChoices: Record<string, string> = {};
  for (const option of options) {
    const chosen = choices?.[option.id];
    effectiveChoices[option.id] =
      chosen !== undefined && option.choices.some((c) => c.id === chosen)
        ? chosen
        : option.defaultChoiceId;
  }

  return { options, effectiveChoices };
}
