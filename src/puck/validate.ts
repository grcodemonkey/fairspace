import { type Config, type Data, walkTree } from "@puckeditor/core";
import { pageConfig } from "./config";

export const MAX_PAGE_DATA_BYTES = 512 * 1024;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * The trust boundary for Puck data: a client can send any JSON to a server action.
 * Throws when the data is not a page that `config` can render.
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

  const checkItems = (items: unknown) => {
    if (!Array.isArray(items)) throw new Error("A slot must be an array");
    for (const item of items) {
      if (!isPlainObject(item) || typeof item.type !== "string" || !Object.hasOwn(config.components, item.type)) {
        throw new Error("Unknown component type");
      }
      if (!isPlainObject(item.props) || typeof item.props.id !== "string") {
        throw new Error("A component needs a string props.id");
      }
    }
  };
  // Check the top level before the walk: the walk reads `item.type` and `item.props` without checks.
  checkItems(input.content);
  // walkTree calls back for each content array, slots included, from the deepest up.
  walkTree(input as Data, config, (content) => {
    checkItems(content);
  });
  // Only the keys the app reads: anything else a client adds is not stored.
  return { root: input.root, content: input.content } as Data;
}
