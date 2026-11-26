// @vitest-environment node
import { expect, test } from "vitest";
import { isSafeHref } from "./safe-href";

const allowed = [
  "https://example.org",
  "HTTPS://EXAMPLE.ORG/a?b=c#d",
  "http://example.org",
  "mailto:hello@example.org",
  "tel:+15555550100",
  "/",
  "/about",
  "/about#team",
  "#top",
  " /about ", // trimmed
];

const rejected = [
  "",
  "javascript:alert(1)",
  "JavaScript:alert(1)",
  " javascript:alert(1)",
  "java\tscript:alert(1)",
  "java\nscript:alert(1)",
  "javascript&#58;alert(1)",
  "&#106;avascript:alert(1)",
  "%6Aavascript:alert(1)",
  "data:text/html,<script>alert(1)</script>",
  "vbscript:msgbox(1)",
  "//evil.example",
  "/\\evil.example",
  "/\t/evil.example",
  "\\\\evil.example",
  "https:evil.example",
  "https:\\\\evil.example",
  "ftp://example.org",
  "about",
  "evil.example",
  "https://exa mple.org",
  "/a\u0000b",
];

test.each(allowed)("allows %j", (href) => expect(isSafeHref(href)).toBe(true));
test.each(rejected)("rejects %j", (href) => expect(isSafeHref(href)).toBe(false));
