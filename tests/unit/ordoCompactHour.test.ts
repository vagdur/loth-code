import { describe, expect, test } from "vitest";
import { compactHourProse, dayCommuneVariantFromHourEntryLists, type SlotEntry } from "../../src/ordo/compactHour.js";
import type { OrdoLabels } from "../../src/types/texts.js";

const labels = {
  sources: {
    propriet: "propriet",
    seasonalPropriet: "årstidens proprium",
    communePrefix: "commune",
    feria: "ferian",
    psalterPrefix: "psaltaret",
    sundayWeekI: "söndag vecka I",
    complementaryPsalmody: "komplementär psalmody",
    fixed: "fasta texter",
  },
  parts: {
    hymn: "hymn",
    antiphons: "antifoner",
    psalms: "psalmer",
    shortReading: "kort läsning",
    responsory: "responsorium",
    benedictusAntiphon: "antifon till Benedictus",
    magnificatAntiphon: "antifon till Magnificat",
    nuncDimittisAntiphon: "antifon till Nunc dimittis",
    intercessions: "förböner",
    concludingPrayer: "kollekt",
    prayerForDay: "böner för dagen",
    firstReading: "första läsning",
    secondReading: "andra läsning",
    versicle: "versikel",
    teDeum: "Te Deum",
    marianAntiphon: "Maria-antifon",
    memoriaAddendum: "tillägg (minnesdag)",
    invitatoryAntiphon: "invitatoriumsantifon",
    invitatoryPsalm: "invitatoriumspsalm",
  },
  prose: {
    from: "från",
    and: "och",
    alternatives: "Alternativ:",
    teDeumSaid: "Te Deum.",
    firstVespersForSunday: "Första vesper för söndagen.",
    allFromSunday: "Allt från söndagen.",
    allFromFeria: "Allt från ferian.",
    allFromPropriet: "Allt från propriet.",
    allFromCommune: "Allt från commune ({name}).",
    allFromPsalter: "Allt från {source}.",
    except: "utom",
    ifMemoriaCelebrated: "Om minnesdagen firas:",
    memoriaAddendum: "Minnesdagstillägg.",
    readingsFrom: "Läsningar från",
    restFrom: "Övrigt från",
    psalmodyOption: "Komplementär psalmodi möjlig.",
    otSunday: "{n}:e söndagen under året",
    complineForWeekday: "Kompletorium för {day}.",
  },
  weekdaysDefinite: {
    Sunday: "söndagen",
  },
} as OrdoLabels;

const feriaPsalter = { week: 1 as const, day: "Wednesday" as const };
const hourOpts = { feriaPsalter, psalterBaseline: "feria" as const };

function entry(slotKey: string, partLabel: string, groupKey: string, phrase: string): SlotEntry {
  return {
    slotKey,
    partLabel,
    described: { groupKey, phrase, isProper: groupKey.startsWith("saint:") },
  };
}

describe("compactHourProse", () => {
  test("single source collapses to Allt från", () => {
    const prose = compactHourProse([
      entry("hymn", "hymn", "saint:st_benedict", "propriet"),
      entry("benedictusAntiphon", "antifon till Benedictus", "saint:st_benedict", "propriet"),
    ], labels);
    expect(prose).toBe("Allt från propriet.");
  });

  test("two sources use except pattern with feria dominant", () => {
    const prose = compactHourProse([
      entry("hymn", "hymn", "saint:st_benedict", "propriet"),
      entry("shortReading", "kort läsning", "common:doctors:0", "commune ([doctors variant 1])"),
    ], labels);
    expect(prose).toContain("utom");
    expect(prose).toContain("commune");
  });

  test("commune over psalter uses psalter as baseline", () => {
    const prose = compactHourProse([
      entry("hymn", "hymn", "common:pastors:0", "commune ([pastors variant 1])"),
      entry("psalmSlots[0]", "antifoner", "psalter:1:Wednesday", "psaltaret vecka 1 onsdag"),
      entry("psalmSlots[1]", "antifoner", "psalter:1:Wednesday", "psaltaret vecka 1 onsdag"),
      entry("shortResponsory", "responsorium", "psalter:1:Wednesday", "psaltaret vecka 1 onsdag"),
      entry("magnificatAntiphon", "antifon till Magnificat", "common:pastors:0", "commune ([pastors variant 1])"),
    ], labels, hourOpts);
    expect(prose).toContain("utom");
    expect(prose).toContain("Allt från ferian");
    expect(prose).not.toMatch(/Allt från commune.*Allt från psaltaret/);
  });

  test("three sources use except pattern", () => {
    const prose = compactHourProse([
      entry("hymn", "hymn", "saint:st_benedict", "propriet"),
      entry("benedictusAntiphon", "antifon till Benedictus", "saint:st_benedict", "propriet"),
      entry("shortReading", "kort läsning", "common:doctors:0", "commune ([doctors variant 1])"),
      entry("concludingPrayer", "kollekt", "common:doctors:0", "commune ([doctors variant 1])"),
      entry("shortResponsory", "responsorium", "psalter:2:Saturday", "psaltaret vecka 2 lördag"),
    ], labels, { feriaPsalter: { week: 2, day: "Saturday" } });
    expect(prose).toContain("utom");
    expect(prose).toContain("commune");
    expect(prose).toContain("från ferian");
  });

  test("invitatory omits psalm 94 when antiphon has another source", () => {
    const prose = compactHourProse([
      entry("antiphon", "invitatoriumsantifon", "saint:st_benedict", "propriet"),
      entry("psalm", "invitatoriumspsalm", "psalm:psalm_94", "psalm 94"),
    ], labels, { hourKey: "invitatory" });
    expect(prose).toBe("Allt från propriet.");
  });
});

describe("dayCommuneVariantFromHourEntryLists", () => {
  test("returns null when commune appears in only one hour", () => {
    const variant = dayCommuneVariantFromHourEntryLists([
      [entry("hymn", "hymn", "saint:st_benedict", "propriet")],
      [entry("shortReading", "kort läsning", "common:bvm:0", "commune ([bvm variant 1])")],
    ], labels);
    expect(variant).toBeNull();
  });

  test("returns variant when commune appears in two hours", () => {
    const variant = dayCommuneVariantFromHourEntryLists([
      [entry("shortReading", "kort läsning", "common:bvm:0", "commune ([bvm variant 1])")],
      [entry("concludingPrayer", "kollekt", "common:bvm:0", "commune ([bvm variant 1])")],
    ], labels);
    expect(variant).toBe("[bvm variant 1]");
  });
});
