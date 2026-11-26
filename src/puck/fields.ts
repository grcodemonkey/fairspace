import type { TextField } from "@puckeditor/core";

/** A text field that holds a link. `parsePageData` rejects the value on save unless `isSafeHref` accepts it. */
export const linkField = (label: string): TextField => ({ type: "text", label, metadata: { href: true } });
