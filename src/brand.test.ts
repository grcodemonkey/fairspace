import { expect, test } from "vitest";
import { BRAND_DEFAULTS, contrastRatio, DARK_BG, HEX, LIGHT_BG, MIN_CONTRAST, onColor, safeHex } from "./brand";

test("contrast-known-ratios", () => {
  expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
  expect(contrastRatio("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
  expect(contrastRatio(BRAND_DEFAULTS.primaryLight, LIGHT_BG)).toBeCloseTo(6.7, 1);
  expect(contrastRatio(BRAND_DEFAULTS.primaryDark, DARK_BG)).toBeCloseTo(7.8, 1);
  expect(contrastRatio("#777777", LIGHT_BG)).toBeLessThan(MIN_CONTRAST);
  expect(contrastRatio("#9ca3af", LIGHT_BG)).toBeLessThan(MIN_CONTRAST);
});

test("on-color-always-passes", () => {
  const grays = Array.from({ length: 52 }, (_, i) => `#${(i * 5).toString(16).padStart(2, "0").repeat(3)}`);
  for (const color of [...grays, "#ff0000", "#00ff00", "#0000ff", "#767676"]) {
    expect(contrastRatio(color, onColor(color))).toBeGreaterThanOrEqual(MIN_CONTRAST);
  }
  expect(onColor("#1d4ed8")).toBe("#ffffff");
  expect(onColor("#60a5fa")).toBe("#000000");
});

test("hex-refuses-non-hex", () => {
  for (const bad of ["red", "#fff", "#12345g", ";}", "#1D4ED8", "#1d4ed8;color:red", " #1d4ed8"]) {
    expect(HEX.test(bad)).toBe(false);
    expect(safeHex(bad, "#000000")).toBe("#000000");
  }
  expect(safeHex("#1d4ed8", "#000000")).toBe("#1d4ed8");
  expect(safeHex(null, "#000000")).toBe("#000000");
});
