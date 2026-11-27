import type { ComponentConfig, Slot } from "@puckeditor/core";
import { mediaField } from "../fields";
import { MediaImage, mediaMeta } from "./media-image";

export type ImageTextProps = { image: string | null; imageSide: "left" | "right"; content: Slot };

export const ImageText: ComponentConfig<ImageTextProps> = {
  label: "Image + text",
  fields: {
    image: mediaField("Image"),
    imageSide: {
      type: "select",
      label: "Image side",
      options: [
        { label: "Left", value: "left" },
        { label: "Right", value: "right" },
      ],
    },
    content: { type: "slot", allow: ["Heading", "RichText", "Button"] },
  },
  defaultProps: { image: null, imageSide: "left", content: [] },
  // The image is first in the DOM, so it stacks over the text on mobile. No image (public): the text takes the full width.
  render: ({ image, imageSide, content: Content, puck }) => {
    const hasImage = !!mediaMeta(puck, image) || puck.isEditing;
    return (
      <div className={`block-container my-6 grid items-center gap-6 ${hasImage ? "md:grid-cols-2" : ""}`}>
        {hasImage && (
          <div className={imageSide === "right" ? "md:order-last" : ""}>
            <MediaImage id={image} puck={puck} sizes="(min-width: 48rem) 24rem, 100vw" />
          </div>
        )}
        <Content className="min-h-16" />
      </div>
    );
  },
};
