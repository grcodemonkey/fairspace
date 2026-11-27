import { type ComponentData, type Data, walkTree } from "@puckeditor/core";
import { pageConfig } from "./config";

const isH1 = (block: ComponentData) =>
  // Hero renders h1 unless level is "h2" (old data has no level); Heading renders h1 only when level is "h1".
  block.type === "Hero" ? block.props.level !== "h2" : block.type === "Heading" && block.props.level === "h1";

/** Advice for the editor header: the text when the page would not render exactly one H1, else null. */
export function h1Warning(data: Data, kind: "page" | "post"): string | null {
  let blocks = 0;
  // walkTree calls back once per content array: the top level and every slot.
  walkTree(data, pageConfig, (content) => {
    blocks += content.filter(isH1).length;
    return content;
  });
  const title = data.root.props?.title;
  // A post's non-blank title renders as the H1 on /news/<slug>.
  const titleH1 = kind === "post" && typeof title === "string" && title.trim() ? 1 : 0;
  const total = blocks + titleH1;
  if (total === 1) return null;
  if (titleH1) return "The post title is the main heading (H1). Set Hero and Heading blocks to H2.";
  if (total > 1) return `This ${kind} has ${total} main headings (H1). Keep one, and set the others to H2.`;
  return kind === "post"
    ? "This post has no title. Add a Title in the page fields. It shows as the main heading."
    : "This page has no main heading (H1). Set one Hero or Heading block to H1.";
}
