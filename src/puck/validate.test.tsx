// @vitest-environment node
import type { Config } from "@puckeditor/core";
import { expect, test } from "vitest";
import { MAX_PAGE_DATA_BYTES, parsePageData } from "./validate";

// One dummy block with a slot, so the test proves the walk reaches into slots before #13 adds real blocks.
const testConfig: Config = {
  components: {
    Section: { fields: { items: { type: "slot" } }, render: () => <div /> },
  },
};

const page = (content: unknown[] = []) => ({ root: { props: { title: "Home" } }, content });
const section = (id: string, items: unknown[] = []) => ({ type: "Section", props: { id, items } });

test("valid-empty-page-passes", () => {
  const data = page();
  expect(parsePageData(data)).toBe(data);
});

test("valid-nested-page-passes", () => {
  expect(() => parsePageData(page([section("a", [section("b")])]), testConfig)).not.toThrow();
});

test("rejects-non-object", () => {
  for (const input of [null, "x", 1, [], undefined]) expect(() => parsePageData(input)).toThrow();
});

test("rejects-missing-root", () => {
  expect(() => parsePageData({ content: [] })).toThrow();
  expect(() => parsePageData({ root: {}, content: [] })).toThrow();
});

test("rejects-content-not-array", () => {
  expect(() => parsePageData({ root: { props: {} }, content: {} })).toThrow();
});

test("rejects-legacy-zones", () => {
  expect(() => parsePageData({ ...page(), zones: { "a:b": [] } })).toThrow();
  expect(() => parsePageData({ ...page(), zones: {} })).not.toThrow();
});

test("rejects-unknown-component-type", () => {
  expect(() => parsePageData(page([{ type: "Script", props: { id: "x" } }]), testConfig)).toThrow(/Unknown/);
  // Inside a slot of a known block. Puck's own walk may throw first ("Could not find component config").
  expect(() =>
    parsePageData(page([section("a", [{ type: "Script", props: { id: "x" } }])]), testConfig),
  ).toThrow();
  // Not an own key of components.
  expect(() => parsePageData(page([{ type: "constructor", props: { id: "x" } }]), testConfig)).toThrow(/Unknown/);
});

test("rejects-component-without-id", () => {
  expect(() => parsePageData(page([{ type: "Section", props: {} }]), testConfig)).toThrow(/props.id/);
  expect(() => parsePageData(page([section("a", [{ type: "Section", props: { id: 1 } }])]), testConfig)).toThrow();
});

test("rejects-oversize-data", () => {
  const data = { root: { props: { title: "x".repeat(MAX_PAGE_DATA_BYTES) } }, content: [] };
  expect(() => parsePageData(data)).toThrow(/too large/);
});
