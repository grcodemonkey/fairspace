import type { Config, Data, Field, Fields, SlotField } from "@puckeditor/core";
import { UUID } from "@/media";
import { pageConfig } from "./config";
import { EMBED_HINT, type EmbedKind, parseEmbedUrl } from "./embed-providers";
import { UNSAFE_HREF_HINT, isSafeHref } from "./safe-href";
import { sanitizeRichText } from "./sanitize";

export const MAX_PAGE_DATA_BYTES = 512 * 1024;
export const MAX_SLOT_DEPTH = 5;
const MAX_ID_LENGTH = 100;
const MEDIA_ID = new RegExp(`^${UUID}$`);

/** A save error the editor can act on. `saveDraft` shows its message; other errors show a general one. */
export class PageDataError extends Error {}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * The trust boundary for Puck data: a client can send any JSON to a server action.
 * Throws when the data is not a page that `config` can render. Checks every prop against its field,
 * deletes props that have no field, and cleans rich text HTML. Mutates `input` in place.
 */
export function parsePageData(input: unknown, config: Config = pageConfig): Data {
  if (!isPlainObject(input)) throw new Error("Page data must be an object");
  // Check the size first, so the tree walk below never sees a huge input.
  if (new TextEncoder().encode(JSON.stringify(input)).length > MAX_PAGE_DATA_BYTES) {
    throw new Error("Page data is too large");
  }
  if (!isPlainObject(input.root) || !isPlainObject(input.root.props)) throw new Error("Page data needs root.props");
  if (!Array.isArray(input.content)) throw new Error("Page data content must be an array");
  // Legacy DropZone data. This app uses slots only.
  if (input.zones !== undefined && !(isPlainObject(input.zones) && Object.keys(input.zones).length === 0)) {
    throw new Error("Page data must not use zones");
  }

  // `slot` is the field that holds these items (none at the top level); `depth` counts slot levels.
  const checkItems = (items: unknown, depth: number, slot?: SlotField, slotName?: string) => {
    if (!Array.isArray(items)) throw new Error("A slot must be an array");
    if (items.length && depth > MAX_SLOT_DEPTH) throw new PageDataError(`Blocks can be nested at most ${MAX_SLOT_DEPTH} levels deep.`);
    items.forEach((item, index) => {
      if (!isPlainObject(item) || typeof item.type !== "string" || !Object.hasOwn(config.components, item.type)) {
        throw new Error("Unknown component type");
      }
      if (!isPlainObject(item.props) || typeof item.props.id !== "string" || item.props.id.length > MAX_ID_LENGTH) {
        throw new Error("A component needs a string props.id");
      }
      const component = config.components[item.type];
      const name = component.label ?? item.type;
      if (slot && ((slot.allow && !slot.allow.includes(item.type)) || slot.disallow?.includes(item.type))) {
        throw new PageDataError(`A ${name} block is not allowed inside ${slotName}.`);
      }
      checkProps(item.props, component.fields ?? {}, name, true, depth);
      // Only the keys the app reads.
      items[index] = { type: item.type, props: item.props };
    });
  };

  const checkProps = (
    props: Record<string, unknown>,
    fields: Fields,
    name: string,
    keepId: boolean,
    depth: number,
  ) => {
    for (const key of Object.keys(props)) {
      if (!(keepId && key === "id") && !Object.hasOwn(fields, key)) delete props[key];
    }
    for (const [key, field] of Object.entries(fields)) {
      if (Object.hasOwn(props, key)) props[key] = checkValue(props[key], field, name, depth);
    }
  };

  const checkValue = (value: unknown, field: Field, name: string, depth: number): unknown => {
    const label = `${name} ${field.label ?? "field"}`;
    switch (field.type) {
      case "text":
      case "textarea":
        if (typeof value !== "string") throw new PageDataError(`${label} must be text.`);
        if (field.metadata?.href && value !== "" && !isSafeHref(value)) {
          throw new PageDataError(`A ${name} link ${UNSAFE_HREF_HINT}.`);
        }
        if (field.metadata?.embed && value !== "" && !parseEmbedUrl(value, field.metadata.embed as EmbedKind)) {
          throw new PageDataError(`The ${field.label ?? "link"} ${EMBED_HINT[field.metadata.embed as EmbedKind]}.`);
        }
        if (field.metadata?.required && value.trim() === "") throw new PageDataError(`${label} is required.`);
        if (typeof field.metadata?.maxLength === "number" && value.length > field.metadata.maxLength) {
          throw new PageDataError(`A ${name} text field can be at most ${field.metadata.maxLength} characters.`);
        }
        return value;
      case "media":
        // No DB lookup on save: a missing or non-image id renders no image.
        if (value === null) return null;
        if (typeof value !== "string" || !MEDIA_ID.test(value)) throw new PageDataError(`${label} must be a media file.`);
        return value;
      case "select":
      case "radio":
        if (!field.options.some((option) => option.value === value)) {
          throw new PageDataError(`${label} has a value that is not in its list.`);
        }
        return value;
      case "number":
        if (typeof value !== "number" || !Number.isFinite(value)) throw new PageDataError(`${label} must be a number.`);
        return value;
      case "richtext":
        if (typeof value !== "string") throw new PageDataError(`${label} must be text.`);
        return sanitizeRichText(value);
      case "slot":
        checkItems(value, depth + 1, field, `a ${name}`);
        return value;
      case "array":
        if (!Array.isArray(value)) throw new Error("An array field must be an array");
        if (field.max !== undefined && value.length > field.max) {
          throw new PageDataError(`${label} can have at most ${field.max} items.`);
        }
        if (field.min !== undefined && value.length < field.min) {
          throw new PageDataError(`${label} needs at least ${field.min} items.`);
        }
        for (const item of value) {
          if (!isPlainObject(item)) throw new Error("An array item must be an object");
          checkProps(item, field.arrayFields as Fields, name, false, depth);
        }
        return value;
      case "object":
        if (!isPlainObject(value)) throw new Error("An object field must be an object");
        checkProps(value, field.objectFields as Fields, name, false, depth);
        return value;
      default:
        // On purpose: a new field type (media picker, embed) must add its own check here.
        throw new Error(`Unsupported field type: ${field.type}`);
    }
  };

  checkProps(input.root.props, config.root?.fields ?? {}, "Page", false, 0);
  checkItems(input.content, 0);
  // Only the keys the app reads: anything else a client adds is not stored.
  return { root: { props: input.root.props }, content: input.content } as Data;
}
