import type { ComponentConfig } from "@puckeditor/core";
import { embedField, requiredTextField } from "../fields";
import { EmbedFrame } from "./embed-frame";

export type VideoProps = { url: string; title: string };

export const Video: ComponentConfig<VideoProps> = {
  label: "Video",
  fields: {
    url: embedField("Video link", "video"),
    title: requiredTextField("Title (for screen readers)"),
  },
  defaultProps: { url: "", title: "Video" },
  render: ({ url, title }) => <EmbedFrame url={url} title={title} kind="video" />,
};
