import type { ComponentConfig } from "@puckeditor/core";
import { embedField, requiredTextField } from "../fields";
import { EmbedFrame } from "./embed-frame";

const HEIGHT_OPTIONS = [
  { label: "Short", value: 500 },
  { label: "Medium", value: 800 },
  { label: "Tall", value: 1100 },
];

export type EmbedProps = { url: string; title: string; height: number };

export const Embed: ComponentConfig<EmbedProps> = {
  label: "Embed",
  fields: {
    url: embedField("Form or donation link", "embed"),
    title: requiredTextField("Title (for screen readers)"),
    height: {
      type: "select",
      label: "Height",
      options: HEIGHT_OPTIONS,
    },
  },
  defaultProps: { url: "", title: "Form", height: 800 },
  render: ({ url, title, height }) => (
    <EmbedFrame url={url} title={title} kind="embed" height={HEIGHT_OPTIONS.some((o) => o.value === height) ? height : 800} />
  ),
};
