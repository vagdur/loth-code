import { describe, expect, test } from "vitest";
import {
  compactDeltaHourProse, compactHourProse, dayCommuneVariantFromHourEntryLists, type SlotEntry,
} from "../../src/ordo/compactHour.js";
import type { OrdoLabels } from "../../src/types/texts.js";

const labels = {
  sources: {
    propriet: "propriet",
    seasonalPropriet: "årstidens proprium",
    communeInline: "communet",
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
    fromUr: "ur",
    and: "och",
    or: "eller",
    alternatives: "Alternativ:",
    teDeumSaid: "Te Deum.",
    firstVespersForSunday: "Första vesper för söndagen.",
    allFromSunday: "Allt från söndagen.",
    allFromFeria: "Allt från ferian.",
    allFromPropriet: "Allt från propriet.",
    allFromCommune: "Allt från {commune} ({name}).",
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

function entry(
  slotKey: string,
  partLabel: string,
  groupKey: string,
  phrase: string,
  alternatives?: SlotEntry["alternatives"],
): SlotEntry {
  return {
    slotKey,
    partLabel,
    described: { groupKey, phrase, isProper: groupKey.startsWith("saint:") },
    ...(alternatives?.length ? { alternatives } : {}),
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

  test("lists non-baseline parts with ur for fixed sources", () => {
    const prose = compactHourProse([
      entry("hymn", "hymn", "saint:st_benedict", "propriet"),
      entry("shortReading", "kort läsning", "common:doctors:0", "communet ([doctors variant 1])"),
    ], labels);
    expect(prose).toBe("Kort läsning ur communet ([doctors variant 1]).");
    expect(prose).not.toContain("utom");
  });

  test("commune over psalter lists only commune deviations", () => {
    const prose = compactHourProse([
      entry("hymn", "hymn", "common:pastors:0", "communet ([pastors variant 1])"),
      entry("psalmSlots[0]", "antifoner", "psalter:1:Wednesday", "psaltaret vecka 1 onsdag"),
      entry("psalmSlots[1]", "antifoner", "psalter:1:Wednesday", "psaltaret vecka 1 onsdag"),
      entry("shortResponsory", "responsorium", "psalter:1:Wednesday", "psaltaret vecka 1 onsdag"),
      entry("magnificatAntiphon", "antifon till Magnificat", "common:pastors:0", "communet ([pastors variant 1])"),
    ], labels, hourOpts);
    expect(prose).toBe(
      "Hymn och antifon till Magnificat ur communet ([pastors variant 1]).",
    );
    expect(prose).not.toContain("Allt från ferian");
  });

  test("lists common and psalter deviations from propriet baseline", () => {
    const prose = compactHourProse([
      entry("hymn", "hymn", "saint:st_benedict", "propriet"),
      entry("benedictusAntiphon", "antifon till Benedictus", "saint:st_benedict", "propriet"),
      entry("shortReading", "kort läsning", "common:doctors:0", "communet ([doctors variant 1])"),
      entry("concludingPrayer", "kollekt", "common:doctors:0", "communet ([doctors variant 1])"),
      entry("shortResponsory", "responsorium", "psalter:2:Saturday", "psaltaret vecka 2 lördag"),
    ], labels, { feriaPsalter: { week: 2, day: "Saturday" } });
    expect(prose).toContain("communet");
    expect(prose).toContain("ur ferian");
    expect(prose).not.toContain("utom");
  });

  test("optional ad-lib slots use från … eller ferian", () => {
    const psalterAlt = {
      groupKey: "psalter:1:Wednesday",
      phrase: "psaltaret vecka 1 onsdag",
      isProper: false,
    };
    const commonAlt = {
      groupKey: "common:pastors:0",
      phrase: "communet ([pastors variant 1])",
      isProper: false,
    };
    const prose = compactHourProse([
      entry(
        "benedictusAntiphon",
        "antifon till Benedictus",
        "common:pastors:0",
        "communet ([pastors variant 1])",
      ),
      entry(
        "hymn",
        "hymn",
        "common:pastors:0",
        "communet ([pastors variant 1])",
        [psalterAlt, commonAlt],
      ),
      entry(
        "shortReading",
        "kort läsning",
        "common:pastors:0",
        "communet ([pastors variant 1])",
        [psalterAlt, commonAlt],
      ),
      entry(
        "intercessions",
        "förböner",
        "common:pastors:0",
        "communet ([pastors variant 1])",
        [psalterAlt, commonAlt],
      ),
      entry("psalmSlots[0]", "antifoner", "psalter:1:Wednesday", "psaltaret vecka 1 onsdag"),
      entry("psalmSlots[1]", "antifoner", "psalter:1:Wednesday", "psaltaret vecka 1 onsdag"),
      entry("psalmSlots[2]", "antifoner", "psalter:1:Wednesday", "psaltaret vecka 1 onsdag"),
      entry("shortResponsory", "responsorium", "psalter:1:Wednesday", "psaltaret vecka 1 onsdag"),
    ], labels, hourOpts);
    expect(prose).toContain("Antifon till Benedictus ur communet");
    expect(prose).toContain("Hymn, kort läsning, och förböner från communet eller ferian");
    expect(prose).not.toContain("utom");
  });

  test("invitatory omits psalm 94 when antiphon has another source", () => {
    const prose = compactHourProse([
      entry("antiphon", "invitatoriumsantifon", "saint:st_benedict", "propriet"),
      entry("psalm", "invitatoriumspsalm", "psalm:psalm_94", "psalm 94"),
    ], labels, { hourKey: "invitatory" });
    expect(prose).toBe("Allt från propriet.");
  });
});

describe("compactDeltaHourProse", () => {
  test("memoria invitatory during Advent: common or feria, not common and seasonal", () => {
    const seasonalAlt = {
      groupKey: "seasonal:advent_w2_wed",
      phrase: "årstidens proprium",
      isProper: true,
    };
    const psalterAlt = {
      groupKey: "psalter:2:Wednesday",
      phrase: "psaltaret vecka 2 onsdag",
      isProper: false,
    };
    const prose = compactDeltaHourProse(
      [
        entry(
          "antiphon",
          "invitatoriumsantifon",
          "common:bvm:0",
          "communet (den saliga jungfru Maria)",
          [seasonalAlt, psalterAlt],
        ),
      ],
      labels,
      {
        hourKey: "invitatory",
        feriaPsalter: { week: 2, day: "Wednesday" },
        dayCommuneVariant: "den saliga jungfru Maria",
        deltaFerialEntries: [
          entry(
            "antiphon",
            "invitatoriumsantifon",
            "seasonal:advent_w2_wed",
            "årstidens proprium",
          ),
        ],
      },
    );
    expect(prose).toBe("Invitatoriumsantifon från communet eller ferian.");
    expect(prose).not.toContain("årstidens proprium");
    expect(prose).not.toContain(" och ");
  });

  test("memoria invitatory in ordinary time: common or feria", () => {
    const psalterAlt = {
      groupKey: "psalter:1:Wednesday",
      phrase: "psaltaret vecka 1 onsdag",
      isProper: false,
    };
    const prose = compactDeltaHourProse(
      [
        entry(
          "antiphon",
          "invitatoriumsantifon",
          "common:pastors:0",
          "communet ([pastors variant 1])",
          [psalterAlt],
        ),
      ],
      labels,
      {
        hourKey: "invitatory",
        feriaPsalter: { week: 1, day: "Wednesday" },
        dayCommuneVariant: "[pastors variant 1]",
        deltaFerialEntries: [
          entry(
            "antiphon",
            "invitatoriumsantifon",
            "psalter:1:Wednesday",
            "psaltaret vecka 1 onsdag",
          ),
        ],
      },
    );
    expect(prose).toBe("Invitatoriumsantifon från communet eller ferian.");
  });
});

describe("dayCommuneVariantFromHourEntryLists", () => {
  test("returns null when commune appears in only one hour", () => {
    const variant = dayCommuneVariantFromHourEntryLists([
      [entry("hymn", "hymn", "saint:st_benedict", "propriet")],
      [entry("shortReading", "kort läsning", "common:bvm:0", "communet ([bvm variant 1])")],
    ], labels);
    expect(variant).toBeNull();
  });

  test("returns variant when commune appears in two hours", () => {
    const variant = dayCommuneVariantFromHourEntryLists([
      [entry("shortReading", "kort läsning", "common:bvm:0", "communet ([bvm variant 1])")],
      [entry("concludingPrayer", "kollekt", "common:bvm:0", "communet ([bvm variant 1])")],
    ], labels);
    expect(variant).toBe("[bvm variant 1]");
  });
});
