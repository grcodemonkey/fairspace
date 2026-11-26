// @vitest-environment node
import { describe, expect, test } from "vitest";
import { MAX_BYTES, sniffType, validateUpload } from "./media";

const bytes = (...parts: (string | number[])[]) =>
  new Uint8Array(parts.flatMap((p) => (typeof p === "string" ? [...p].map((c) => c.charCodeAt(0)) : p)));

describe("sniff-detects-types", () => {
  test.each([
    ["image/jpeg", bytes([0xff, 0xd8, 0xff, 0xe0])],
    ["image/png", bytes([0x89], "PNG\r\n\x1a\n")],
    ["image/gif", bytes("GIF89a")],
    ["image/gif", bytes("GIF87a")],
    ["image/webp", bytes("RIFF", [0, 0, 0, 0], "WEBPVP8 ")],
    ["image/avif", bytes([0, 0, 0, 0x1c], "ftypavif")],
    ["application/pdf", bytes("%PDF-1.7")],
  ])("%s", (type, data) => {
    expect(sniffType(data)).toBe(type);
  });

  test.each([
    ["svg", bytes('<svg xmlns="http://www.w3.org/2000/svg">')],
    ["xml-svg", bytes('<?xml version="1.0"?><svg>')],
    ["html", bytes("<!doctype html><script>")],
    ["text", bytes("hello world")],
    ["empty", bytes()],
    ["heic", bytes([0, 0, 0, 0x18], "ftypheic")],
  ])("refuses %s", (_, data) => {
    expect(sniffType(data)).toBeNull();
  });
});

describe("validate-type-and-size", () => {
  test.each(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif", "application/pdf"])(
    "allows %s",
    (type) => expect(validateUpload({ type, size: 1 })).toBeNull(),
  );

  test.each(["image/svg+xml", "text/html", "", "toString", "__proto__"])("refuses type %j", (type) => {
    expect(validateUpload({ type, size: 1 })).toMatch(/Only JPEG/);
  });

  test("refuses 0 bytes", () => expect(validateUpload({ type: "image/png", size: 0 })).toMatch(/empty/));
  test("allows MAX", () => expect(validateUpload({ type: "image/png", size: MAX_BYTES })).toBeNull());
  test("refuses MAX+1", () => expect(validateUpload({ type: "image/png", size: MAX_BYTES + 1 })).toMatch(/10 MB/));
  test("refuses a non-integer size", () => expect(validateUpload({ type: "image/png", size: 1.5 })).not.toBeNull());
});
