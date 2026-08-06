/**
 * The ambient sanctoral registry is process-global, which is fine for a
 * one-shot script and not fine for a server handling two locales at once.
 * `withSanctoralRegistry` is the scoped alternative; these tests pin the
 * properties a host relies on.
 */

import { afterEach, beforeAll, describe, expect, test } from "vitest";

import { loadSanctoralRegistry } from "../../src/calendar/sanctoralRegistryNode.js";
import {
  getSanctoralRegistry,
  getSeasonalObservance,
  initSanctoralRegistry,
  withSanctoralRegistry,
} from "../../src/calendar/saints.js";
import { resolveDay } from "../../src/calendar/index.js";
import { utcDate } from "../../src/calendar/computus.js";
import type { SanctoralCalendarRegistry } from "../../src/calendar/sanctoralRegistry.js";
import { dataRoot } from "../helpers/paths.js";

let registry: SanctoralCalendarRegistry;

beforeAll(async () => {
  registry = await loadSanctoralRegistry(dataRoot, "en");
});

/**
 * These tests deliberately leave the global unset; other suites install it in
 * their own beforeAll, and vitest gives each file its own module registry.
 */
afterEach(() => {
  // @ts-expect-error -- deliberately restoring the "never initialized" state.
  initSanctoralRegistry(null);
});

describe("withSanctoralRegistry", () => {
  test("installs the registry for the duration of the callback", () => {
    const inside = withSanctoralRegistry(registry, () => getSanctoralRegistry());
    expect(inside).toBe(registry);
  });

  test("restores the previous registry afterwards", () => {
    withSanctoralRegistry(registry, () => null);
    expect(() => getSanctoralRegistry()).toThrow(/not loaded/);
  });

  test("restores even when the callback throws", () => {
    expect(() =>
      withSanctoralRegistry(registry, () => {
        throw new Error("boom");
      }),
    ).toThrow("boom");
    expect(() => getSanctoralRegistry()).toThrow(/not loaded/);
  });

  test("nests, so a second locale inside the first is restored correctly", () => {
    withSanctoralRegistry(registry, () => {
      withSanctoralRegistry(registry, () => null);
      expect(getSanctoralRegistry()).toBe(registry);
    });
  });

  test("rejects an async callback rather than restoring underneath it", () => {
    expect(() =>
      withSanctoralRegistry(registry, () => Promise.resolve("too late")),
    ).toThrow(/must be synchronous/);
  });

  test("a particular calendar resolves inside the scope", () => {
    const day = withSanctoralRegistry(registry, () =>
      resolveDay(utcDate(2026, 5, 10), "stockholm"),
    );
    expect(day).toBeTruthy();
  });
});

describe("the soft-failure the scope guard exists to prevent", () => {
  test("a particular calendar throws when no registry is installed", () => {
    expect(() => resolveDay(utcDate(2026, 5, 10), "stockholm")).toThrow(/not loaded/);
  });

  test("but 'general' silently falls back to the default policy", () => {
    // Documenting, not endorsing: this is why a forgotten wrapper on a
    // general-calendar render yields plausible-but-wrong output instead of an
    // error, and why the Worker has exactly one render path.
    expect(getSeasonalObservance("general")).toBeTruthy();
  });
});
