import { expect, test } from "vitest";
import { validAnalytics } from "./analytics";

test("analytics-id-formats", () => {
  expect(validAnalytics("plausible", "example.org")).toEqual({ provider: "plausible", id: "example.org" });
  expect(validAnalytics("plausible", "sub.example.org")).not.toBeNull();
  expect(validAnalytics("google", "G-ABC123XYZ")).not.toBeNull();
  for (const id of ["example", "https://example.org", "example.org/", '"><script>', "Example.org", `${"a".repeat(250)}.org`]) {
    expect(validAnalytics("plausible", id), id).toBeNull();
  }
  for (const id of ["g-abc123", 'G-12"><x', "G-AB", "UA-12345"]) expect(validAnalytics("google", id), id).toBeNull();
  expect(validAnalytics("matomo", "example.org")).toBeNull();
  expect(validAnalytics("google", null)).toBeNull();
});
