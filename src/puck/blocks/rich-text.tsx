import type { ComponentConfig, RichText as RichTextValue } from "@puckeditor/core";

export type RichTextProps = { body: RichTextValue };

// The toolbar offers only what sanitize.ts keeps, so a save never silently drops an editor's formatting.
export const RichText: ComponentConfig<RichTextProps> = {
  label: "Rich text",
  fields: {
    body: {
      type: "richtext",
      label: "Text",
      options: {
        heading: { levels: [2, 3, 4] },
        code: false,
        codeBlock: false,
        horizontalRule: false,
        // Same tab: no unannounced new window.
        link: { HTMLAttributes: { target: null, rel: null } },
      },
    },
  },
  defaultProps: { body: "<p>Write something here.</p>" },
  // Puck gives `body` as a node that renders the stored HTML.
  render: ({ body }) => <div className="rich-text-content block-container my-4">{body}</div>,
};
