import type { ComponentConfig } from "@puckeditor/core";

const LEVELS = ["h1", "h2", "h3", "h4"] as const;
type Level = (typeof LEVELS)[number];

const SIZE: Record<Level, string> = { h1: "text-4xl", h2: "text-3xl", h3: "text-2xl", h4: "text-xl" };

export type HeadingProps = { text: string; level: Level; align: "left" | "center" };

export const Heading: ComponentConfig<HeadingProps> = {
  label: "Heading",
  fields: {
    text: { type: "text", label: "Text" },
    level: { type: "select", label: "Level", options: LEVELS.map((l) => ({ label: l.toUpperCase(), value: l })) },
    align: {
      type: "select",
      label: "Alignment",
      options: [
        { label: "Left", value: "left" },
        { label: "Center", value: "center" },
      ],
    },
  },
  defaultProps: { text: "Heading", level: "h2", align: "left" },
  render: ({ text, level, align }) => {
    const Tag = LEVELS.includes(level) ? level : "h2";
    return <Tag className={`block-container my-4 font-bold ${SIZE[Tag]} ${align === "center" ? "text-center" : ""}`}>{text}</Tag>;
  },
};
