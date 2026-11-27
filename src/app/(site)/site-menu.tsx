import { getMenu } from "@/menu";
import { MenuLink } from "./menu-link";

const link = "inline-block py-2 hover:underline aria-[current=page]:font-semibold aria-[current=page]:underline";

// WAI "disclosure navigation menu with top-level links": each top item is a link; a separate toggle opens its children.
// <details> gives the toggle its keyboard and expanded state with no client JS.
// shortcut: no close on Escape or outside click; add a small client handler if users ask for it.
export async function SiteMenu() {
  const items = await getMenu();
  if (items.length === 0) return null;
  return (
    <nav aria-label="Main" className="w-full md:w-auto">
      {/* Under md this is the "Menu" button; at md and wider globals.css hides the summary and always shows the list. */}
      <details className="site-menu">
        <summary className="cursor-pointer py-2">Menu</summary>
        <ul className="flex flex-col md:flex-row md:items-center md:gap-6">
          {items.map((item, i) => (
            <li key={i} className="relative md:flex md:items-center md:gap-1">
              <MenuLink href={item.href} label={item.label} className={link} />
              {/* Inline under md: the toggle sits after the link and the children break to full rows below. */}
              {item.children.length > 0 && (
                <details className="group inline md:block">
                  <summary aria-label={`More in ${item.label}`} className="inline-block cursor-pointer list-none px-1 py-2">
                    <span aria-hidden="true" className="inline-block group-open:rotate-180">
                      ▾
                    </span>
                  </summary>
                  <ul className="pl-4 md:absolute md:right-0 md:top-full md:z-10 md:min-w-48 md:border md:bg-background md:px-4 md:py-2 md:shadow">
                    {item.children.map((child, j) => (
                      <li key={j}>
                        <MenuLink href={child.href} label={child.label} className={link} />
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </li>
          ))}
        </ul>
      </details>
    </nav>
  );
}
