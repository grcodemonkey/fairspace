import type { ComponentConfig } from "@puckeditor/core";
import { embedField, requiredTextField } from "../fields";
import { EmbedFrame } from "./embed-frame";

const HEIGHTS = [500, 800, 1100];

export type EmbedProps = { url: string; title: string; height: number };

export const Embed: ComponentConfig<EmbedProps> = {
  label: "Embed",
  fields: {
    url: embedField("Form or donation link", "embed"),
    title: requiredTextField("Title (for screen readers)"),
    height: {
      type: "select",
      label: "Height",
      options: [
        { label: "Short", value: 500 },
        { label: "Medium", value: 800 },
        { label: "Tall", value: 1100 },
      ],
    },
  },
  defaultProps: { url: "", title: "Form", height: 800 },
  render: ({ url, title, height }) => (
    <EmbedFrame url={url} title={title} kind="embed" height={HEIGHTS.includes(height) ? height : 800} />
  ),
};
