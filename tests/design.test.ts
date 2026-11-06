import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("documented palette matches the canonical runtime theme", () => {
  const design = readFileSync(new URL("../DESIGN.md", import.meta.url), "utf8");
  const css = readFileSync(
    new URL("../src/styles.css", import.meta.url),
    "utf8",
  );
  const palette = design.split(/colors:\r?\n/)[1]?.split("typography:")[0];
  assert.ok(palette, "DESIGN.md must declare a palette");
  for (const [, name, hex] of palette.matchAll(
    /^  ([\w-]+): "(#[0-9a-f]+)"/gim,
  )) {
    const token =
      name === "scrollbar-thumb" ? "--scrollbar-thumb" : `--color-${name}`;
    assert.ok(
      css.toLowerCase().includes(`${token}: ${hex.toLowerCase()};`),
      `${name} must match its CSS variable`,
    );
  }
});
