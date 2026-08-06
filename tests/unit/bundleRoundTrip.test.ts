/**
 * The bundle format has to be lossless, because a Worker host only ever sees
 * the bundle — if serializing drops something, the hosted hours are quietly
 * wrong rather than broken.  Rendering an hour through both paths and
 * comparing the markup is the cheapest check that covers the whole graph.
 */

import { beforeAll, describe, expect, test } from "vitest";

import { loadRepository, readRepoBundle } from "../../src/data/repositoryNode.js";
import { DataRepository } from "../../src/data/repository.js";
import {
  loadSanctoralRegistry,
  readRegistryBundle,
} from "../../src/calendar/sanctoralRegistryNode.js";
import { SanctoralCalendarRegistry } from "../../src/calendar/sanctoralRegistry.js";
import { withSanctoralRegistry } from "../../src/calendar/saints.js";
import { defaultContext, resolveDay, utcDate } from "../../src/calendar/index.js";
import { buildDay } from "../../src/hours/index.js";
import { HtmlAssembler } from "../../src/assemblers/htmlAssembler.js";
import { dataRoot } from "../helpers/paths.js";

const LOCALE = "en";
const DATE = utcDate(2026, 5, 10);

/** Round-trip through JSON, so this tests the wire format and not just the shape. */
function reserialize<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function renderLauds(repo: DataRepository, registry: SanctoralCalendarRegistry): string {
  return withSanctoralRegistry(registry, () => {
    const day = buildDay(resolveDay(DATE, "general"), defaultContext("general"));
    return new HtmlAssembler({ outputMode: "hybrid", fragmentOnly: true })
      .assembleLauds(day.lauds, repo);
  });
}

describe("repo and registry bundles round-trip losslessly", () => {
  let viaYaml: string;
  let viaBundle: string;

  beforeAll(async () => {
    const [yamlRepo, yamlRegistry] = await Promise.all([
      loadRepository(dataRoot, LOCALE),
      loadSanctoralRegistry(dataRoot, LOCALE),
    ]);
    const [repoBundle, registryBundle] = await Promise.all([
      readRepoBundle(dataRoot, LOCALE),
      readRegistryBundle(dataRoot, LOCALE),
    ]);

    viaYaml = renderLauds(yamlRepo, yamlRegistry);
    viaBundle = renderLauds(
      DataRepository.fromBundle(reserialize(repoBundle)),
      SanctoralCalendarRegistry.fromBundle(reserialize(registryBundle)),
    );
  });

  test("an assembled hour is byte-identical either way", () => {
    expect(viaBundle).toBe(viaYaml);
    expect(viaBundle.length).toBeGreaterThan(0);
  });

  test("toBundle is the inverse of fromBundle", async () => {
    const bundle = reserialize(await readRepoBundle(dataRoot, LOCALE));
    expect(DataRepository.fromBundle(bundle).toBundle()).toEqual(bundle);

    const registry = reserialize(await readRegistryBundle(dataRoot, LOCALE));
    expect(SanctoralCalendarRegistry.fromBundle(registry).toBundle()).toEqual(registry);
  });

  test("the bundle carries the whole melody store, aliases included", async () => {
    const bundle = await readRepoBundle(dataRoot, LOCALE);
    const repo = DataRepository.fromBundle(reserialize(bundle));
    expect(bundle.melodies.length).toBeGreaterThan(0);
    expect(repo.getAllMelodies()).toHaveLength(bundle.melodies.length);
    for (const [alias, canonical] of bundle.melodyAliases) {
      expect(repo.getMelody(alias)?.id).toBe(canonical);
      expect(repo.isMelodyAlias(alias)).toBe(true);
    }
  });
});
