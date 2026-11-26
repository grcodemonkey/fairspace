import Link from "next/link";

export default function Forbidden() {
  return (
    <main className="p-8">
      <h1 className="text-3xl font-bold mb-4">No access</h1>
      <p className="mb-4">You do not have access to this page.</p>
      <Link href="/admin" className="underline">
        Back to Admin
      </Link>
    </main>
  );
}
