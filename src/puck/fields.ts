import type { Field, TextField } from "@puckeditor/core";
import type { EmbedKind } from "./embed-providers";

/** A text field that holds a link. `parsePageData` rejects the value on save unless `isSafeHref` accepts it. */
export const linkField = (label: string): TextField => ({ type: "text", label, metadata: { href: true } });

// A user field type: the config stays data only and server-safe. The editor draws it through
// `overrides.fieldTypes.media` (edit/media-field.tsx); `parsePageData` checks it in `case "media"`.
declare module "@puckeditor/core" {
  interface FieldTypes {
    media: { type: "media" };
  }
}

/** A field that holds the id of an image in the media library, or null. Store the id: alt and URL are read at render time. */
export const mediaField = (label: string): Field => ({ type: "media", label });

/** A text field that holds a video or form page link. `parsePageData` rejects it unless `parseEmbedUrl` accepts it. */
export const embedField = (label: string, kind: EmbedKind): TextField => ({ type: "text", label, metadata: { embed: kind } });

/** A text field that `parsePageData` rejects when it is empty. */
export const requiredTextField = (label: string): TextField => ({ type: "text", label, metadata: { required: true } });
