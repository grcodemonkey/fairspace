import Link from "next/link";

// The public theme shell. #18 brand and #19 menu render here.
export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <header className="border-b px-8 py-4">
        <Link href="/" className="text-lg font-semibold">
          Fairspace
        </Link>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t px-8 py-4 text-sm text-gray-500">Built with Fairspace</footer>
    </>
  );
}
