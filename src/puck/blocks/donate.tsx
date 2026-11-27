import type { ComponentConfig } from "@puckeditor/core";
import { linkField } from "../fields";
import { ButtonLink } from "./button";

export type DonateProps = { label: string; href: string; text: string };

/** A link to the donation page on any platform (Givebutter, Donorbox, PayPal, ...). No payment code runs on this site. */
export const Donate: ComponentConfig<DonateProps> = {
  label: "Donate",
  fields: {
    label: { type: "text", label: "Label" },
    href: linkField("Donation page link"),
    text: { type: "textarea", label: "Short text above the button (optional)" },
  },
  defaultProps: { label: "Donate", href: "", text: "" },
  render: ({ label, href, text }) =>
    href ? (
      <div className="block-container my-4">
        {text ? <p className="mb-3">{text}</p> : null}
        <ButtonLink label={label} href={href} />
      </div>
    ) : (
      <></>
    ),
};
