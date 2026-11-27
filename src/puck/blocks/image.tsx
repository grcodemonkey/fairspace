import type { ComponentConfig } from "@puckeditor/core";
import { mediaField } from "../fields";
import { MediaImage, mediaMeta } from "./media-image";

export type ImageProps = { image: string | null; caption: string };

export const Image: ComponentConfig<ImageProps> = {
  label: "Image",
  fields: {
    image: mediaField("Image"),
    caption: { type: "text", label: "Caption" },
  },
  defaultProps: { image: null, caption: "" },
  // No image, no block on the public page (same rule as Button): a caption alone is confusing.
  render: ({ image, caption, puck }) =>
    mediaMeta(puck, image) || puck.isEditing ? (
      <figure className="block-container my-6">
        <MediaImage id={image} puck={puck} sizes="(min-width: 48rem) 48rem, 100vw" />
        {caption && <figcaption className="mt-2 text-sm">{caption}</figcaption>}
      </figure>
    ) : (
      <></>
    ),
};
