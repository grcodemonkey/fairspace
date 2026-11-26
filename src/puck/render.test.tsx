// @vitest-environment node
import { Render } from "@puckeditor/core";
import { prerender } from "react-dom/static";
import { expect, test } from "vitest";
import { allBlocksFixture } from "./all-blocks.fixture";
import { pageConfig } from "./config";
import { parsePageData } from "./validate";

// prerender (not renderToString) waits for Suspense, so the lazy rich-text render runs instead of the fallback.
async function renderHtml(data = allBlocksFixture()) {
  const { prelude } = await prerender(<Render config={pageConfig} data={data} />);
  return new Response(prelude).text();
}

test("render-matches", async () => {
  const html = await renderHtml();
  expect(html).toMatch(/<h1[^>]*>Welcome to Fairspace<\/h1>/);
  expect(html).toMatch(/<h2[^>]*>What we do<\/h2>/);
  expect(html).toMatch(/<h3[^>]*>Support us<\/h3>/);
  expect(html).toMatch(/<a href="\/get-involved"[^>]*>Get involved<\/a>/);
  expect(html).toMatch(/<a href="mailto:hello@example.org"[^>]*>Contact us<\/a>/);
  expect(html).toMatch(/<a href="\/donate"[^>]*>Donate<\/a>/);
  expect(html).toMatch(/class="[^"]*md:grid-flow-col/);
  expect(html).toMatch(/<strong>weekly events<\/strong>/);
  expect(html).toContain('<a href="https://example.org"');
  expect(html).not.toMatch(/<script|javascript:/i);
});

test("button-without-link-renders-nothing", async () => {
  const data = { root: { props: {} }, content: [{ type: "Button", props: { id: "b", label: "Dead", href: "", variant: "primary" } }] };
  expect(await renderHtml(data)).not.toContain("Dead");
});

test("render-after-save-has-no-script", async () => {
  const data = allBlocksFixture();
  data.content[2].props.body = '<p>x</p><script>alert(1)</script><img src=x onerror="alert(1)">';
  const html = await renderHtml(parsePageData(data));
  expect(html).not.toMatch(/<script|onerror|alert/i);
});
