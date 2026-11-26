import { Suspense } from "react";
import { requireAdmin } from "@/guards";

// Admin-only shell; #7 adds the user list and invites.
export default function UsersPage() {
  return (
    <main className="p-8">
      <Suspense fallback={<p>Loading…</p>}>
        <UsersHeading />
      </Suspense>
    </main>
  );
}

async function UsersHeading() {
  await requireAdmin();
  return <h1 className="text-3xl font-bold mb-4">Users</h1>;
}
