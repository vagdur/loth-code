import { expect, test } from "vitest";
import { withGabcHeader } from "../../src/assemblers/gabcHeader.js";

test("prepends name and mode before a notation-only body", () => {
  expect(withGabcHeader("(c4) A(g)men.(g)", "lauds-score-1", { mode: 8 })).toBe(
    "name:lauds-score-1;\nmode: 8;\n%%\n(c4) A(g)men.(g)",
  );
});

test("omits mode when not given", () => {
  expect(withGabcHeader("(c4) A(g)men.(g)", "lauds-score-1")).toBe(
    "name:lauds-score-1;\n%%\n(c4) A(g)men.(g)",
  );
});

test("leaves a body that already has a header alone", () => {
  const src = "name:kept;\nmode: 1;\n%%\n(c4) A(g)men.(g)";
  expect(withGabcHeader(src, "lauds-score-1", { mode: 8 })).toBe(src);
});
