// @vitest-environment node
import type { ComponentData, Data } from "@puckeditor/core";
import { expect, test } from "vitest";
import { allBlocksFixture } from "./all-blocks.fixture";
import { h1Warning } from "./headings";

const doc = (content: ComponentData[], title = ""): Data => ({ root: { props: { title } }, content });
const hero = (props: object = { level: "h1" }): ComponentData => ({ type: "Hero", props: { id: crypto.randomUUID(), ...props } });
const heading = (level: string): ComponentData => ({ type: "Heading", props: { id: crypto.randomUUID(), level } });
const columns = (...inner: ComponentData[]): ComponentData => ({
  type: "Columns",
  props: { id: crypto.randomUUID(), columns: [{ content: [] }, { content: inner }] },
});
const imageText = (...inner: ComponentData[]): ComponentData => ({
  type: "ImageText",
  props: { id: crypto.randomUUID(), content: inner },
});

test("empty-page-warns-missing", () => {
  expect(h1Warning(doc([]), "page")).toMatch(/no main heading/);
});
test("hero-default-is-one", () => {
  expect(h1Warning(doc([hero()]), "page")).toBeNull();
});
test("hero-without-level-counts", () => {
  expect(h1Warning(doc([hero({})]), "page")).toBeNull();
});
test("heading-h1-in-columns-counts", () => {
  expect(h1Warning(doc([hero({ level: "h2" }), columns(heading("h1"))]), "page")).toBeNull();
});
test("two-h1-in-slots-warns-extra", () => {
  expect(h1Warning(doc([hero(), imageText(heading("h1"))]), "page")).toMatch(/2 main headings/);
});
test("post-title-only-is-one", () => {
  expect(h1Warning(doc([heading("h2")], "News"), "post")).toBeNull();
});
test("post-hero-h1-warns-extra", () => {
  expect(h1Warning(doc([hero()], "News"), "post")).toMatch(/post title is the main heading/);
});
test("post-blank-title-warns", () => {
  expect(h1Warning(doc([], "  "), "post")).toMatch(/no title/);
});
test("post-blank-title-two-h1-warns-count", () => {
  expect(h1Warning(doc([hero(), heading("h1")], ""), "post")).toMatch(/This post has 2 main headings/);
});
test("post-blank-title-one-block-silent", () => {
  // Matches what renders: no title h1, one block h1.
  expect(h1Warning(doc([hero()], ""), "post")).toBeNull();
});
test("fixture-has-one-h1", () => {
  expect(h1Warning(allBlocksFixture(), "page")).toBeNull();
});
