import Link from "next/link";
import { Suspense } from "react";
import { signOut } from "@/auth";
import { requireUser } from "@/guards";

export default function AdminPage() {
  return (
    <main className="p-8">
      <h1 className="text-3xl font-bold mb-4">Admin</h1>
      {/* The guard reads cookies; with cacheComponents it must stream in behind Suspense. */}
      <Suspense fallback={<p>Loading…</p>}>
        <SignedInAs />
      </Suspense>
    </main>
  );
}

async function SignedInAs() {
  const user = await requireUser();

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/sign-in" });
  }

  return (
    <div className="flex flex-col gap-3 items-start">
      <p>
        Signed in as {user.email} · {user.role === "admin" ? "Admin" : "Editor"}
      </p>
      <Link href="/admin/pages" className="underline">
        Pages
      </Link>
      {/* A hint only: /admin/users runs its own guard. */}
      {user.role === "admin" && (
        <Link href="/admin/users" className="underline">
          Users
        </Link>
      )}
      <form action={signOutAction}>
        <button type="submit" className="border rounded px-3 py-2 font-semibold">
          Sign out
        </button>
      </form>
    </div>
  );
}
