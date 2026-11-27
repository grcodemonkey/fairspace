"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, Suspense, useEffect, useRef } from "react";

// `section`: the child hrefs of a top item. On one of those pages the top item gets aria-current="true".
type Props = { href: string; label: string; className?: string; section?: string[] };

// usePathname suspends in the prerendered shell of /[[...slug]] (the slug is not known yet), so the fallback is the
// same link without aria-current.
export function MenuLink(props: Props) {
  return (
    <Suspense fallback={<Link href={props.href} className={props.className}>{props.label}</Link>}>
      <CurrentLink {...props} />
    </Suspense>
  );
}

function CurrentLink({ href, label, className, section }: Props) {
  const pathname = usePathname();
  const current = pathname === href ? "page" : section?.includes(pathname) ? "true" : undefined;
  return (
    <Link href={href} className={className} aria-current={current}>
      {label}
    </Link>
  );
}

type SubMenuProps = { hrefs: string[]; className: string; children: ReactNode };

/** A dropdown. In the mobile "Menu" panel it starts open when one of its children is the current page, so the current
 * link shows. On desktop it stays closed: open, it would cover the page; the top link marks the section instead. */
export function SubMenu(props: SubMenuProps) {
  return (
    <Suspense fallback={<details className={props.className}>{props.children}</details>}>
      <OpenOnCurrent {...props} />
    </Suspense>
  );
}

function OpenOnCurrent({ hrefs, className, children }: SubMenuProps) {
  const current = hrefs.includes(usePathname());
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    // Same breakpoint as md and the .site-menu rule in globals.css. Under it the dropdown sits inside the closed panel.
    if (current && matchMedia("(width < 48rem)").matches) ref.current!.open = true;
  }, [current]);
  return (
    <details ref={ref} className={className}>
      {children}
    </details>
  );
}
