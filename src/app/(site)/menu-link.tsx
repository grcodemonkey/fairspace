"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, Suspense } from "react";

type Props = { href: string; label: string; className?: string };

// usePathname suspends in the prerendered shell of /[[...slug]] (the slug is not known yet), so the fallback is the
// same link without aria-current.
export function MenuLink(props: Props) {
  return (
    <Suspense fallback={<Link href={props.href} className={props.className}>{props.label}</Link>}>
      <CurrentLink {...props} />
    </Suspense>
  );
}

function CurrentLink({ href, label, className }: Props) {
  const current = usePathname() === href;
  return (
    <Link href={href} className={className} aria-current={current ? "page" : undefined}>
      {label}
    </Link>
  );
}

type SubMenuProps = { hrefs: string[]; className: string; children: ReactNode };

/** A dropdown that starts open when one of its children is the current page, so the current link shows. */
export function SubMenu(props: SubMenuProps) {
  return (
    <Suspense fallback={<details className={props.className}>{props.children}</details>}>
      <OpenOnCurrent {...props} />
    </Suspense>
  );
}

function OpenOnCurrent({ hrefs, className, children }: SubMenuProps) {
  const open = hrefs.includes(usePathname());
  return (
    <details className={className} open={open}>
      {children}
    </details>
  );
}
