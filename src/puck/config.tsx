import type { Config } from "@puckeditor/core";
import type { ReactNode } from "react";
import { Button } from "./blocks/button";
import { CardGrid } from "./blocks/card-grid";
import { Columns } from "./blocks/columns";
import { Donate } from "./blocks/donate";
import { Embed } from "./blocks/embed";
import { Heading } from "./blocks/heading";
import { Hero } from "./blocks/hero";
import { Image } from "./blocks/image";
import { ImageText } from "./blocks/image-text";
import { RichText } from "./blocks/rich-text";
import { Video } from "./blocks/video";
import { mediaField } from "./fields";
import { SEO_DESCRIPTION_MAX } from "./seo";

// The one Puck config for the editor and (in #11) for <Render>. No hooks here or in the blocks, so it is safe on the server.
// Use slot fields for nesting, never DropZone. Every field type a block uses needs a check in validate.ts.
export const pageConfig: Config = {
  components: { Hero, Heading, RichText, Button, Image, ImageText, CardGrid, Columns, Video, Embed, Donate } as Config["components"],
  root: {
    fields: {
      title: { type: "text", label: "Title" },
      // SEO fields, read by generateMetadata on the public page. Old drafts without these keys stay valid.
      description: {
        type: "textarea",
        label: "Description (search results, about 160 characters)",
        metadata: { maxLength: SEO_DESCRIPTION_MAX },
      },
      socialImage: mediaField("Social image"),
      noindex: {
        type: "radio",
        label: "Hide from search engines",
        options: [
          { label: "No", value: false },
          { label: "Yes", value: true },
        ],
      },
    },
    render: ({ children }: { children?: ReactNode }) => <>{children}</>,
  },
};
