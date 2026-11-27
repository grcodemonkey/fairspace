// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { REQUIRED_ENV, missingEnv } from "./vercel-build";

describe("missingEnv", () => {
  const full = Object.fromEntries(REQUIRED_ENV.map((name) => [name, "x"]));
  it("lists every name for an empty env", () => expect(missingEnv({})).toEqual(REQUIRED_ENV));
  it("lists none for a full env", () => expect(missingEnv(full)).toEqual([]));
  it("treats blank as missing", () => expect(missingEnv({ ...full, AUTH_SECRET: "  " })).toEqual(["AUTH_SECRET"]));
});

describe("README deploy button", () => {
  const link = readFileSync("README.md", "utf8").match(/https:\/\/vercel\.com\/new\/clone\?[^)\s]+/)?.[0];
  const params = new URL(link ?? "https://invalid.example").searchParams;
  it("prompts every required var except the Neon-provided DATABASE_URL", () => {
    expect(params.get("env")?.split(",")).toEqual(REQUIRED_ENV.filter((name) => name !== "DATABASE_URL"));
  });
  it("creates a Neon store and clones this repo", () => {
    expect(JSON.parse(params.get("stores") ?? "[]")[0]).toMatchObject({ integrationSlug: "neon" });
    expect(params.get("repository-url")).toBe("https://github.com/grcodemonkey/fairspace");
  });
});
