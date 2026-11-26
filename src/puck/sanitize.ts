import sanitizeHtml from "sanitize-html";
import { isSafeHref } from "./safe-href";

const ALIGN = { "text-align": [/^(left|center|right|justify)$/] };

/**
 * Cleans rich text HTML on save. Puck's server <Render> puts the stored string raw into its Suspense
 * fallback, so the stored value itself must be safe. Server only: validate.ts imports it.
 */
export function sanitizeRichText(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ["p", "br", "strong", "b", "em", "i", "u", "s", "h2", "h3", "h4", "ul", "ol", "li", "blockquote", "a"],
    // Tiptap's text-align writes `style` on paragraphs and headings.
    allowedAttributes: { a: ["href"], p: ["style"], h2: ["style"], h3: ["style"], h4: ["style"] },
    allowedStyles: { p: ALIGN, h2: ALIGN, h3: ALIGN, h4: ALIGN },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedSchemesAppliedToAttributes: ["href"],
    allowProtocolRelative: false,
    // The same link rule as the link fields. The parser has decoded entities, so "java&#9;script:" arrives as "java\tscript:".
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: attribs.href && isSafeHref(attribs.href) ? { href: attribs.href } : ({} as Record<string, string>),
      }),
    },
  });
}
