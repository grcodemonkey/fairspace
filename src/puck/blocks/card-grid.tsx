import type { ComponentConfig } from "@puckeditor/core";
import { linkField, mediaField } from "../fields";
import { isSafeHref } from "../safe-href";
import { MediaImage } from "./media-image";

type Card = { image: string | null; title: string; text: string; href: string };
export type CardGridProps = { cards: Card[] };

export const CardGrid: ComponentConfig<CardGridProps> = {
  label: "Card grid",
  fields: {
    cards: {
      type: "array",
      label: "Cards",
      min: 1,
      max: 12,
      arrayFields: {
        image: mediaField("Image"),
        title: { type: "text", label: "Title" },
        text: { type: "textarea", label: "Text" },
        href: linkField("Link"),
      },
      defaultItemProps: { image: null, title: "", text: "", href: "" },
      getItemSummary: (item, index) => item.title || `Card ${(index ?? 0) + 1}`,
    },
  },
  defaultProps: { cards: [{ image: null, title: "Card title", text: "", href: "" }] },
  // The title is the link, not the whole card: one clear link name for screen readers.
  render: ({ cards, puck }) => (
    <div className="block-container my-6 grid gap-6 sm:grid-cols-2 md:grid-cols-3">
      {cards.map((card, i) => (
        <article key={i} className="flex flex-col gap-2">
          <MediaImage id={card.image} puck={puck} crop sizes="(min-width: 48rem) 16rem, (min-width: 40rem) 50vw, 100vw" />
          {card.title && (
            <h3 className="text-xl font-bold">
              {/* An unsaved edit in the editor can hold an unsafe value: show the title, but no link. */}
              {card.href && isSafeHref(card.href) ? (
                <a href={card.href} className="text-primary underline">
                  {card.title}
                </a>
              ) : (
                card.title
              )}
            </h3>
          )}
          {card.text && <p>{card.text}</p>}
        </article>
      ))}
    </div>
  ),
};
