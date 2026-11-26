import type { Config } from "@puckeditor/core";
import type { ReactNode } from "react";

// The one Puck config for the editor and (in #11) for <Render>. No hooks here, so it is safe on the server.
// #13 adds the blocks to `components`. Use slot fields for nesting, never DropZone.
export const pageConfig: Config = {
  components: {},
  root: {
    fields: { title: { type: "text", label: "Title" } },
    render: ({ children }: { children?: ReactNode }) => <>{children}</>,
  },
};
