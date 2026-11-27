import { expect, test } from "vitest";
import { parseEmbedUrl } from "./embed-providers";

const YT = "https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ";
const FORM = "1FAIpQLSfD7mPwX9Xl2D5oZ8h3bQ0wZzq1";

test.each([
  ["https://www.youtube.com/watch?v=aqz-KE-bpKQ", YT],
  ["https://youtube.com/watch?v=aqz-KE-bpKQ&t=30s", YT],
  ["https://m.youtube.com/watch?v=aqz-KE-bpKQ", YT],
  ["https://youtu.be/aqz-KE-bpKQ?si=abc", YT],
  ["https://www.youtube.com/embed/aqz-KE-bpKQ", YT],
  ["https://www.youtube.com/shorts/aqz-KE-bpKQ", YT],
  ["https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ", YT],
  ["  https://WWW.YouTube.com/watch?v=aqz-KE-bpKQ  ", YT],
  ["https://vimeo.com/76979871", "https://player.vimeo.com/video/76979871?dnt=1"],
  ["https://vimeo.com/76979871/abc123", "https://player.vimeo.com/video/76979871?dnt=1&h=abc123"],
  ["https://player.vimeo.com/video/76979871", "https://player.vimeo.com/video/76979871?dnt=1"],
  ["https://player.vimeo.com/video/76979871?h=abc123", "https://player.vimeo.com/video/76979871?dnt=1&h=abc123"],
])("video accepts %s", (url, src) => {
  expect(parseEmbedUrl(url, "video")).toBe(src);
});

test.each([
  [`https://docs.google.com/forms/d/e/${FORM}/viewform`, `https://docs.google.com/forms/d/e/${FORM}/viewform?embedded=true`],
  [`https://docs.google.com/forms/d/e/${FORM}/viewform?usp=sf_link`, `https://docs.google.com/forms/d/e/${FORM}/viewform?embedded=true`],
  ["https://donorbox.org/save-the-park", "https://donorbox.org/embed/save-the-park"],
  ["https://donorbox.org/embed/save-the-park", "https://donorbox.org/embed/save-the-park"],
  ["https://www.donorbox.org/save-the-park", "https://donorbox.org/embed/save-the-park"],
])("embed accepts %s", (url, src) => {
  expect(parseEmbedUrl(url, "embed")).toBe(src);
});

test.each([
  "",
  "not a url",
  "http://www.youtube.com/watch?v=aqz-KE-bpKQ", // not https
  "https://www.youtube.com.evil.com/watch?v=aqz-KE-bpKQ", // lookalike suffix
  "https://evilyoutube.com/watch?v=aqz-KE-bpKQ", // lookalike prefix
  "https://youtube.com@evil.com/watch?v=aqz-KE-bpKQ", // userinfo: the host is evil.com
  "https://user:pw@www.youtube.com/watch?v=aqz-KE-bpKQ", // userinfo on a real host
  "https://www.youtube.com:8443/watch?v=aqz-KE-bpKQ", // custom port
  "https://www.youtube.com/watch?v=aqz-KE-bpK", // 10-char id
  "https://www.youtube.com/watch?v=aqz-KE-bpKQx", // 12-char id
  "https://www.youtube.com/watch?v=aqz-KE%22bpKQ", // encoded quote in the id
  "https://www.youtube.com/watch?v=aqz-KE-bp%3CQ", // encoded <
  "https://www.youtube.com/embed/aqz-KE-bpKQ/extra", // extra path segment
  "https://youtu.be/watch?v=aqz-KE-bpKQ",
  "https://www.youtube.com/playlist?list=PL123",
  "https://vimeo.com/abc", // non-numeric id
  "https://vimeo.com/76979871/XYZ", // hash not lowercase hex
  "https://player.vimeo.com/video/76979871?h=%3Cscript%3E",
  "https://vimeo.com/76979871/abc123/extra",
  "javascript:alert(1)",
  "data:text/html,<script>alert(1)</script>",
  '<iframe src="https://www.youtube.com/embed/aqz-KE-bpKQ"></iframe>',
  "https://www.paypal.com/donate/?hosted_button_id=ABC", // PayPal is a Donate link, not an embed
  "https://docs.google.com/forms/d/e/x/viewform", // embed kind only
])("video rejects %s", (url) => {
  expect(parseEmbedUrl(url, "video")).toBeNull();
});

test.each([
  "https://forms.gle/abc123", // short link: resolving it needs a server fetch
  `https://docs.google.com/forms/d/${FORM}/edit`, // the editor link, not the public one
  `https://docs.google.com/forms/d/e/${FORM}/viewform/extra`,
  `https://docs.google.com.evil.com/forms/d/e/${FORM}/viewform`,
  `https://docs.google.com/document/d/${FORM}/edit`,
  "https://donorbox.org/a/b",
  "https://donorbox.org/embed/save%2Fthe-park",
  "https://donorbox.org.evil.com/save-the-park",
  "http://donorbox.org/save-the-park",
  "https://givebutter.com/save-the-park", // script widget only: use the Donate block
  "https://www.paypal.com/donate/?hosted_button_id=ABC",
  "https://www.youtube.com/watch?v=aqz-KE-bpKQ", // video kind only
  "javascript:alert(1)",
  "data:text/html;base64,PHNjcmlwdD4=",
])("embed rejects %s", (url) => {
  expect(parseEmbedUrl(url, "embed")).toBeNull();
});
