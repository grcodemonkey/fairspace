import type { ComponentConfig } from "@puckeditor/core";
import Image from "next/image";
import { linkField, mediaField } from "../fields";
import { ButtonLink } from "./button";
import { mediaMeta } from "./media-image";

export type HeroProps = {
  title: string;
  level: "h1" | "h2";
  subtitle: string;
  buttonLabel: string;
  buttonHref: string;
  image?: string | null;
};

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
    image: mediaField("Background image"),
  },
  defaultProps: { title: "Welcome", level: "h1", subtitle: "", buttonLabel: "", buttonHref: "", image: null },
  render: ({ title, level, subtitle, buttonLabel, buttonHref, image, puck }) => {
    const Heading = level === "h2" ? "h2" : "h1";
    const background = mediaMeta(puck, image);
    return (
      <section className={`px-6 py-16 text-center ${background ? "relative isolate overflow-hidden text-white" : ""}`}>
        {background && (
          <>
            {/* Decorative: the title says what the hero is about. */}
            <Image src={background.url} alt="" fill sizes="100vw" className="-z-20 object-cover" />
            {/* Fixed overlay: white text on black/60 over any photo is at least 5.7:1 (over pure white), so contrast never depends on the image.
                Keep in step with the test "hero-background-is-decorative" (render.test.tsx), which asserts text-white and bg-black/60. */}
            <div className="absolute inset-0 -z-10 bg-black/60" />
          </>
        )}
        {puck.isEditing && image && !background && (
          <p className="mb-4 bg-gray-200 p-2 text-sm text-gray-800">This image was deleted. Choose another.</p>
        )}
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
