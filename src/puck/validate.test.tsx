// @vitest-environment node
import type { Config } from "@puckeditor/core";
import { expect, test } from "vitest";
import { allBlocksFixture } from "./all-blocks.fixture";
import { MAX_PAGE_DATA_BYTES, MAX_SLOT_DEPTH, PageDataError, parsePageData } from "./validate";

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
  expect(parsePageData(data)).toEqual(data);
});

test("drops-extra-top-level-keys", () => {
  expect(parsePageData({ ...page(), zones: {}, extra: "x".repeat(10) })).toEqual(page());
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

// --- #13 blocks: every prop is checked against its field on save. ---

let nextId = 0;
const block = (type: string, props: Record<string, unknown>) => ({ type, props: { id: `${type}-${nextId++}`, ...props } });
const inColumns = (...items: unknown[]) => block("Columns", { columns: [{ content: items }, { content: [] }] });
const button = (href: unknown) => block("Button", { label: "Go", href, variant: "primary" });
const hero = (buttonHref: string, level = "h1") =>
  block("Hero", { title: "Hi", level, subtitle: "", buttonLabel: "Go", buttonHref });
const richText = (body: unknown) => block("RichText", { body });
type Column = { content: { props: Record<string, unknown> }[] };
const firstColumn = (data: ReturnType<typeof parsePageData>) => (data.content[0].props.columns as Column[])[0].content;

test("all-blocks-fixture-passes", () => {
  const data = allBlocksFixture();
  expect(parsePageData(structuredClone(data))).toEqual(data);
});

test("rejects-javascript-href", () => {
  for (const href of ["javascript:alert(1)", " JavaScript:alert(1)", "java\tscript:alert(1)", "data:text/html,x"]) {
    expect(() => parsePageData(page([button(href)]))).toThrow(PageDataError);
    expect(() => parsePageData(page([hero(href)]))).toThrow(/Hero link must start with/);
    expect(() => parsePageData(page([inColumns(button(href))]))).toThrow(/Button link must start with/);
    expect(() => parsePageData(page([inColumns(hero(href))]))).toThrow();
  }
});

test("rejects-protocol-relative-href", () => {
  for (const href of ["//evil.example", "/\\evil.example", "/\t/evil.example"]) {
    expect(() => parsePageData(page([button(href)]))).toThrow(/link must start with/);
  }
});

test("allows-relative-mailto-tel-hash", () => {
  for (const href of ["/about", "#top", "mailto:a@example.org", "tel:+15555550100", "https://example.org", ""]) {
    expect(() => parsePageData(page([button(href)]))).not.toThrow();
  }
});

test("rejects-unknown-select-value", () => {
  expect(() => parsePageData(page([block("Heading", { text: "x", level: "script", align: "left" })]))).toThrow(
    /not in its list/,
  );
  expect(() => parsePageData(page([hero("/", "h3")]))).toThrow(PageDataError);
  expect(() => parsePageData(page([block("Button", { label: "x", href: "/", variant: { a: 1 } })]))).toThrow();
});

test("rejects-non-string-text", () => {
  expect(() => parsePageData(page([block("Heading", { text: { __html: "<b>" }, level: "h2" })]))).toThrow(
    /must be text/,
  );
  expect(() => parsePageData(page([button(1)]))).toThrow(/must be text/);
  expect(() => parsePageData(page([richText(["<p>x</p>"])]))).toThrow(/must be text/);
});

test("rejects-too-many-columns", () => {
  const columns = (n: number) => block("Columns", { columns: Array.from({ length: n }, () => ({ content: [] })) });
  expect(() => parsePageData(page([columns(4)]))).not.toThrow();
  expect(() => parsePageData(page([columns(5)]))).toThrow(/at most 4/);
  expect(() => parsePageData(page([block("Columns", { columns: "x" })]))).toThrow();
  expect(() =>
    parsePageData(page([block("Columns", { columns: [{ content: [{ type: "Script", props: { id: "x" } }] }, { content: [] }] })])),
  ).toThrow(/Unknown/);
});

test("strips-unknown-props", () => {
  const item = block("Heading", {
    text: "x",
    level: "h2",
    align: "left",
    dangerouslySetInnerHTML: { __html: "<img src=x onerror=alert(1)>" },
    className: "x",
  });
  const nested = inColumns(block("Button", { label: "x", href: "/", variant: "primary", onClick: "alert(1)" }));
  const data = parsePageData(page([nested, item]));
  expect(Object.keys(data.content[1].props).sort()).toEqual(["align", "id", "level", "text"]);
  expect(Object.keys(firstColumn(data)[0].props).sort()).toEqual(["href", "id", "label", "variant"]);
  // Root props without a field go too.
  expect(parsePageData({ root: { props: { title: "x", script: "y" } }, content: [] }).root.props).toEqual({
    title: "x",
  });
});

test("sanitizes-rich-text", () => {
  const payloads: [string, RegExp][] = [
    ["<p>a</p><script>alert(1)</script>", /script|alert/i],
    ['<p>a<img src=x onerror="alert(1)"></p>', /img|onerror/i],
    ['<p><a href="javascript:alert(1)">x</a></p>', /javascript|href/i],
    ['<p><a href="JaVaScRiPt&#58;alert(1)">x</a></p>', /javascript|alert|href/i],
    ['<p><a href="java&#x09;script:alert(1)">x</a></p>', /script|alert|href/i],
    ['<p><a href="&#106;avascript:alert(1)">x</a></p>', /script|alert|href/i],
    ['<p><a href="//evil.example">x</a></p>', /evil/],
    ['<p><a href="/\\evil.example">x</a></p>', /evil/],
    ['<p><a href="https://example.org" onclick="alert(1)" target="_blank">x</a></p>', /onclick|target/],
    ['<p style="color:red;background:url(javascript:alert(1))">a</p>', /style|color|javascript/],
    ["<h1>big</h1>", /<h1/],
    ['<svg><script>alert(1)</script></svg><svg onload="alert(1)"></svg>', /svg|alert/i],
    ['<iframe src="https://evil.example"></iframe>', /iframe|evil/],
    ['<p><a href="data:text/html;base64,PHNjcmlwdD4=">x</a></p>', /data:/],
    ["<style>p{color:red}</style><p>a</p>", /style|color/],
  ];
  for (const [html, unsafe] of payloads) {
    expect(parsePageData(page([richText(html)])).content[0].props.body).not.toMatch(unsafe);
    // Inside a Columns slot too.
    expect(firstColumn(parsePageData(page([inColumns(richText(html))])))[0].props.body).not.toMatch(unsafe);
  }
  const safe =
    '<h2 style="text-align:center">T</h2><p><strong>b</strong> <a href="https://example.org/a">l</a> <a href="/x">r</a></p>';
  expect(parsePageData(page([richText(safe)])).content[0].props.body).toBe(safe);
});

test("rejects-unsupported-field-type", () => {
  const custom: Config = {
    components: { Widget: { fields: { x: { type: "custom", render: () => <div /> } }, render: () => <div /> } },
  };
  expect(() => parsePageData(page([{ type: "Widget", props: { id: "w", x: 1 } }]), custom)).toThrow(
    /Unsupported field type/,
  );
});

test("slot-disallow-enforced", () => {
  expect(() => parsePageData(page([inColumns(block("Columns", { columns: [{ content: [] }, { content: [] }] }))]))).toThrow(
    /Columns block is not allowed/,
  );
  expect(() => parsePageData(page([inColumns(hero("/"))]))).toThrow(/Hero block is not allowed/);
  // `allow` too.
  const allowConfig: Config = {
    components: {
      Box: { fields: { items: { type: "slot", allow: ["Leaf"] } }, render: () => <div /> },
      Leaf: { fields: {}, render: () => <div /> },
    },
  };
  const box = (items: unknown[]) => ({ type: "Box", props: { id: `box-${nextId++}`, items } });
  expect(() => parsePageData(page([box([{ type: "Leaf", props: { id: "l" } }])]), allowConfig)).not.toThrow();
  expect(() => parsePageData(page([box([box([])])]), allowConfig)).toThrow(/not allowed/);
});

test("rejects-deep-nesting", () => {
  const nest = (levels: number): ReturnType<typeof section> =>
    levels === 0 ? section(`s${nextId++}`) : section(`s${nextId++}`, [nest(levels - 1)]);
  expect(() => parsePageData(page([nest(MAX_SLOT_DEPTH)]), testConfig)).not.toThrow();
  expect(() => parsePageData(page([nest(MAX_SLOT_DEPTH + 1)]), testConfig)).toThrow(/nested at most/);
});

test("rejects-too-few-columns", () => {
  expect(() => parsePageData(page([block("Columns", { columns: [{ content: [] }] })]))).toThrow(/at least 2/);
});

test("rebuilds-items-and-root", () => {
  const item = { ...button("/"), readOnly: true, extra: "<script>" };
  const data = parsePageData({ root: { props: { title: "x" }, extra: 1 }, content: [inColumns({ ...button("/"), x: 1 }), item] });
  expect(Object.keys(data.root)).toEqual(["props"]);
  expect(Object.keys(data.content[1])).toEqual(["type", "props"]);
  expect(Object.keys(firstColumn(data)[0])).toEqual(["type", "props"]);
  expect(() => parsePageData(page([{ type: "Button", props: { id: "x".repeat(101) } }]))).toThrow(/props.id/);
});

test("root-title-must-be-string", () => {
  expect(() => parsePageData({ root: { props: { title: { toString: "x" } } }, content: [] })).toThrow(/must be text/);
  expect(() => parsePageData({ root: { props: { title: "ok" } }, content: [] })).not.toThrow();
});

const root = (props: Record<string, unknown>) => ({ root: { props }, content: [] });

test("description-max-length", () => {
  expect(() => parsePageData(root({ description: "x".repeat(300) }))).not.toThrow();
  expect(() => parsePageData(root({ description: "x".repeat(301) }))).toThrow("A Page text field can be at most 300 characters.");
});

test("media-id-format", () => {
  const id = crypto.randomUUID();
  for (const ok of [null, id]) expect(() => parsePageData(root({ socialImage: ok }))).not.toThrow();
  for (const bad of ["../x", {}, 1, id.toUpperCase()]) {
    expect(() => parsePageData(root({ socialImage: bad }))).toThrow(PageDataError);
  }
});

test("noindex-boolean-only", () => {
  expect(() => parsePageData(root({ noindex: true }))).not.toThrow();
  expect(() => parsePageData(root({ noindex: "true" }))).toThrow(PageDataError);
});

test("root-seo-props-kept", () => {
  const props = { title: "T", description: "D", socialImage: crypto.randomUUID(), noindex: false };
  expect(parsePageData(root({ ...props, junk: 1 })).root.props).toEqual(props);
});

test("rejects-unlisted-embed-url", () => {
  for (const url of ["https://evil.example/watch?v=x", "https://www.youtube.com.evil.com/watch?v=aqz-KE-bpKQ", "javascript:alert(1)"]) {
    expect(() => parsePageData(page([block("Video", { url, title: "Clip" })]))).toThrow(/YouTube or Vimeo/);
    expect(() => parsePageData(page([inColumns(block("Embed", { url, title: "Form", height: 800 }))]))).toThrow(
      /Google Forms/,
    );
  }
});

test("rejects-empty-video-title", () => {
  expect(() => parsePageData(page([block("Video", { url: "https://youtu.be/aqz-KE-bpKQ", title: "  " })]))).toThrow(/required/);
  expect(() => parsePageData(page([block("Embed", { url: "", title: "", height: 800 })]))).toThrow(/required/);
});

test("accepts-empty-embed-url", () => {
  expect(() => parsePageData(page([block("Video", { url: "", title: "Video" })]))).not.toThrow();
  expect(() => parsePageData(page([block("Embed", { url: "", title: "Form", height: 500 })]))).not.toThrow();
});

test("rejects-unsafe-donate-link-and-bad-height", () => {
  const donate = block("Donate", { label: "Give", href: "javascript:alert(1)", text: "" });
  expect(() => parsePageData(page([donate]))).toThrow(/must start with/);
  expect(() => parsePageData(page([block("Embed", { url: "", title: "Form", height: 123 })]))).toThrow(/not in its list/);
});

// --- #14 media blocks ---

const cardGrid = (image: unknown) =>
  block("CardGrid", { cards: [{ image, title: "T", text: "", href: "" }, { image: null, title: "U", text: "", href: "" }] });

test("card-media-id-checked", () => {
  expect(() => parsePageData(page([cardGrid("not-a-uuid")]))).toThrow(/Card grid Image must be a media file/);
  expect(() => parsePageData(page([cardGrid(crypto.randomUUID().toUpperCase())]))).toThrow(PageDataError);
  const id = crypto.randomUUID();
  const cards = parsePageData(page([cardGrid(id)])).content[0].props.cards as { image: unknown }[];
  expect(cards.map((c) => c.image)).toEqual([id, null]);
});

test("image-text-slot-allow", () => {
  const imageText = (...content: unknown[]) => block("ImageText", { image: null, imageSide: "left", content });
  expect(() => parsePageData(page([imageText(richText("<p>x</p>"), button("/"))]))).not.toThrow();
  expect(() => parsePageData(page([imageText(inColumns())]))).toThrow(/Columns block is not allowed inside a Image \+ text/);
});

test("columns-disallow-media-layouts", () => {
  expect(() => parsePageData(page([inColumns(cardGrid(null))]))).toThrow(/Card grid block is not allowed/);
  expect(() => parsePageData(page([inColumns(block("Image", { image: null, caption: "" }))]))).not.toThrow();
});

test("hero-background-media-id-checked", () => {
  expect(() => parsePageData(page([block("Hero", { title: "Hi", image: "x" })]))).toThrow(/Hero Background image must be a media file/);
});
