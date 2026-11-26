import type { ComponentConfig, Slot } from "@puckeditor/core";

export type ColumnsProps = { columns: { content: Slot }[] };

export const Columns: ComponentConfig<ColumnsProps> = {
  label: "Columns",
  fields: {
    columns: {
      type: "array",
      label: "Columns",
      min: 2,
      max: 4,
      arrayFields: { content: { type: "slot", disallow: ["Columns", "Hero"] } },
      defaultItemProps: { content: [] },
      getItemSummary: (_item, index) => `Column ${(index ?? 0) + 1}`,
    },
  },
  defaultProps: { columns: [{ content: [] }, { content: [] }] },
  // Stacks on mobile; from md up, one equal-width column per item, so no class map per count.
  render: ({ columns }) => (
    <div className="my-6 grid gap-6 md:auto-cols-fr md:grid-flow-col">
      {columns.map(({ content: Content }, i) => (
        <Content key={i} className="min-h-16" />
      ))}
    </div>
  ),
};
