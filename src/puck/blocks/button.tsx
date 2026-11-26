import type { ComponentConfig } from "@puckeditor/core";
import { linkField } from "../fields";
import { isSafeHref } from "../safe-href";

type Variant = "primary" | "secondary";

const VARIANT_CLASS: Record<Variant, string> = {
  primary: "bg-primary text-on-primary border-primary",
  secondary: "bg-transparent text-primary border-primary",
};

/** A link that looks like a button: it navigates, so it is an <a>. Shared with Hero. */
export function ButtonLink({ label, href, variant = "primary" }: { label: string; href?: string; variant?: Variant }) {
  const className = `inline-block rounded-md border-2 px-5 py-2.5 font-semibold no-underline ${VARIANT_CLASS[variant] ?? VARIANT_CLASS.primary}`;
  // An unsaved edit in the editor can hold an unsafe value: show the style, but no link.
  if (!href || !isSafeHref(href)) return <span className={className}>{label}</span>;
  return (
    <a href={href} className={className}>
      {label}
    </a>
  );
}

export type ButtonProps = { label: string; href: string; variant: Variant };

export const Button: ComponentConfig<ButtonProps> = {
  label: "Button",
  fields: {
    label: { type: "text", label: "Label" },
    href: linkField("Link"),
    variant: {
      type: "select",
      label: "Style",
      options: [
        { label: "Primary", value: "primary" },
        { label: "Secondary", value: "secondary" },
      ],
    },
  },
  defaultProps: { label: "Learn more", href: "/", variant: "primary" },
  // No link, no button: a dead button only confuses visitors.
  render: ({ label, href, variant }) =>
    href ? (
      <div className="block-container my-4">
        <ButtonLink label={label} href={href} variant={variant} />
      </div>
    ) : (
      <></>
    ),
};
