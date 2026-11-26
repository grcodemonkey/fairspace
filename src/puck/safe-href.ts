// Anchored allowlist: a link must start with one of these. Anything else (javascript:, data:, //host, /\host) fails.
const SAFE_HREF = /^(https?:\/\/|mailto:|tel:|#|\/(?![/\\]))/i;
// Browsers drop tabs and newlines inside a URL ("java\tscript:", "/\t/host"), so reject any whitespace or control character.
const UNSAFE_CHAR = /[\s\u0000-\u001f\u007f]/;

export function isSafeHref(href: string): boolean {
  const value = href.trim();
  return !UNSAFE_CHAR.test(value) && SAFE_HREF.test(value);
}

export const UNSAFE_HREF_HINT = "must start with https://, http://, mailto:, tel:, / or #";
