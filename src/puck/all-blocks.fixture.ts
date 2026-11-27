import type { Data } from "@puckeditor/core";

/** One page that uses every block. For unit tests, the e2e seed, and the render (#11) and axe (#17) checks. */
export const allBlocksFixture = (): Data => ({
  root: { props: { title: "All blocks" } },
  content: [
    {
      type: "Hero",
      props: {
        id: "hero-1",
        title: "Welcome to Fairspace",
        level: "h1",
        subtitle: "A community space for everyone.",
        buttonLabel: "Get involved",
        buttonHref: "/get-involved",
      },
    },
    { type: "Heading", props: { id: "heading-1", text: "What we do", level: "h2", align: "left" } },
    {
      type: "RichText",
      props: {
        id: "rich-text-1",
        body: '<p>We run <strong>weekly events</strong> and <a href="https://example.org">open workshops</a>.</p><ul><li>Meetups</li><li>Classes</li></ul>',
      },
    },
    {
      type: "Columns",
      props: {
        id: "columns-1",
        columns: [
          {
            content: [
              { type: "Heading", props: { id: "heading-2", text: "Visit", level: "h3", align: "left" } },
              { type: "RichText", props: { id: "rich-text-2", body: "<p>Open Monday to Friday.</p>" } },
            ],
          },
          {
            content: [
              { type: "Heading", props: { id: "heading-3", text: "Support us", level: "h3", align: "left" } },
              { type: "Button", props: { id: "button-2", label: "Donate", href: "/donate", variant: "primary" } },
            ],
          },
        ],
      },
    },
    { type: "Button", props: { id: "button-1", label: "Contact us", href: "mailto:hello@example.org", variant: "secondary" } },
    { type: "Video", props: { id: "video-1", url: "https://www.youtube.com/watch?v=aqz-KE-bpKQ", title: "Our work in two minutes" } },
    {
      type: "Embed",
      props: {
        id: "embed-1",
        url: "https://docs.google.com/forms/d/e/1FAIpQLSfD7mPwX9Xl2D5oZ8h3bQ0wZzq1JYJ8yWcXrN2sQ3x4y5z6aA/viewform",
        title: "Volunteer sign-up form",
        height: 800,
      },
    },
    {
      type: "Donate",
      props: {
        id: "donate-1",
        label: "Give now",
        href: "https://www.paypal.com/donate/?hosted_button_id=EXAMPLE123",
        text: "Gifts are processed by PayPal.",
      },
    },
  ],
});
