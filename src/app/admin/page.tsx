import { redirect } from "next/navigation";
import { Suspense } from "react";
import { auth, signOut } from "@/auth";

export default function AdminPage() {
  return (
    <main className="p-8">
      <h1 className="text-3xl font-bold mb-4">Admin</h1>
      {/* auth() reads cookies; with cacheComponents it must stream in behind Suspense. */}
      <Suspense fallback={<p>Loading…</p>}>
        <SignedInAs />
      </Suspense>
    </main>
  );
}

async function SignedInAs() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/sign-in" });
  }

  return (
    <div className="flex flex-col gap-3 items-start">
      <p>Signed in as {session.user.email}</p>
      <form action={signOutAction}>
        <button type="submit" className="border rounded px-3 py-2 font-semibold">
          Sign out
        </button>
      </form>
    </div>
  );
}
