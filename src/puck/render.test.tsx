// @vitest-environment node
import { Render } from "@puckeditor/core";
import { prerender } from "react-dom/static";
import { expect, test } from "vitest";
import type { MediaMap } from "@/media";
import { allBlocksFixture, FIXTURE_MEDIA_ID } from "./all-blocks.fixture";
import { pageConfig } from "./config";
import { parsePageData } from "./validate";

// prerender (not renderToString) waits for Suspense, so the lazy rich-text render runs instead of the fallback.
async function renderHtml(data = allBlocksFixture(), media: MediaMap = {}) {
  const { prelude } = await prerender(<Render config={pageConfig} data={data} metadata={{ media }} />);
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

test("embeds-render-sandboxed", async () => {
  const html = await renderHtml();
  const video = html.match(/<iframe[^>]*youtube-nocookie\.com\/embed\/aqz-KE-bpKQ[^>]*>/)?.[0] ?? "";
  expect(video).toContain('title="Our work in two minutes"');
  expect(video).toContain('loading="lazy"');
  expect(video).toContain('referrerPolicy="strict-origin-when-cross-origin"');
  expect(video).toMatch(/sandbox="allow-scripts allow-same-origin [^"]*"/);
  expect(video).not.toContain("allow-forms");
  const form = html.match(/<iframe[^>]*docs\.google\.com\/forms\/[^>]*>/)?.[0] ?? "";
  expect(form).toContain("viewform?embedded=true");
  expect(form).toContain('title="Volunteer sign-up form"');
  expect(form).toMatch(/sandbox="[^"]*allow-forms/);
  expect(form).not.toMatch(/payment|allow-top-navigation/);
  expect(html).toMatch(/<a href="https:\/\/www.paypal.com\/donate\/\?hosted_button_id=EXAMPLE123"[^>]*>Give now<\/a>/);
  expect(html).toContain("Gifts are processed by PayPal.");
});

test("stored-bad-embed-url-renders-no-iframe", async () => {
  // Data that skipped parsePageData (old or hand-edited rows): the render check is the second wall.
  const data = {
    root: { props: {} },
    content: [
      { type: "Video", props: { id: "v", url: "https://youtube.com@evil.com/embed/aqz-KE-bpKQ", title: "x" } },
      { type: "Embed", props: { id: "e", url: "javascript:alert(1)//docs.google.com", title: "x", height: 800 } },
      { type: "Donate", props: { id: "d", label: "Give", href: "javascript:alert(1)", text: "" } },
    ],
  };
  const html = await renderHtml(data);
  expect(html).not.toContain("<iframe");
  expect(html).not.toMatch(/javascript:|evil/);
});

const bike = (alt: string | null): MediaMap => ({ [FIXTURE_MEDIA_ID]: { url: `/media/${FIXTURE_MEDIA_ID}.png`, alt } });

test("render-media-blocks", async () => {
  const html = await renderHtml(allBlocksFixture(), bike("A bike"));
  // Image, Image + text, and two cards.
  expect(html.match(/<img [^>]*alt="A bike"/g)).toHaveLength(4);
  expect(html).toMatch(/srcSet="[^"]*%2Fmedia%2F/);
  expect(html).toContain("<figcaption");
  expect(html).toMatch(/<h3[^>]*><a href="\/market"[^>]*>Market<\/a><\/h3>/);
  // A card with no link has a plain title.
  expect(html).toMatch(/<h3[^>]*>Bike kitchen<\/h3>/);
});

test("alt-null-renders-empty", async () => {
  const html = await renderHtml(allBlocksFixture(), bike(null));
  expect(html.match(/<img [^>]*alt=""/g)).toHaveLength(4);
  expect(html).not.toContain("No alt text");
});

test("unknown-media-renders-no-img", async () => {
  const html = await renderHtml();
  expect(html).not.toContain("<img");
  expect(html).not.toMatch(/deleted|Choose an image/);
  // The Image block (and its caption) is gone.
  expect(html).not.toContain("Our bike repair day.");
  // Image + text keeps its text.
  expect(html).toContain("Thirty raised beds");
});

test("hero-background-is-decorative", async () => {
  const data = allBlocksFixture();
  data.content[0].props.image = FIXTURE_MEDIA_ID;
  const html = await renderHtml(data, bike("A bike"));
  expect(html).toMatch(/<section class="[^"]*text-white[^"]*"><img [^>]*alt=""/);
  expect(html).toContain("bg-black/60");
});
