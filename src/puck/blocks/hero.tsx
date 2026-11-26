import type { ComponentConfig } from "@puckeditor/core";
import { linkField } from "../fields";
import { ButtonLink } from "./button";

export type HeroProps = {
  title: string;
  level: "h1" | "h2";
  subtitle: string;
  buttonLabel: string;
  buttonHref: string;
};

// #14 adds an optional image field.
export const Hero: ComponentConfig<HeroProps> = {
  label: "Hero",
  fields: {
    title: { type: "text", label: "Title" },
    level: {
      type: "select",
      label: "Heading level",
      options: [
        { label: "H1 (page title)", value: "h1" },
        { label: "H2", value: "h2" },
      ],
    },
    subtitle: { type: "textarea", label: "Subtitle" },
    buttonLabel: { type: "text", label: "Button label" },
    buttonHref: linkField("Button link"),
  },
  defaultProps: { title: "Welcome", level: "h1", subtitle: "", buttonLabel: "", buttonHref: "" },
  render: ({ title, level, subtitle, buttonLabel, buttonHref }) => {
    const Heading = level === "h2" ? "h2" : "h1";
    return (
      <section className="px-6 py-16 text-center">
        <Heading className="text-4xl font-bold md:text-5xl">{title}</Heading>
        {subtitle && <p className="mx-auto mt-4 max-w-2xl text-lg">{subtitle}</p>}
        {buttonLabel && buttonHref && (
          <div className="mt-8">
            <ButtonLink label={buttonLabel} href={buttonHref} />
          </div>
        )}
      </section>
    );
  },
};
