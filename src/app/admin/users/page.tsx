import { Suspense } from "react";
import { requireAdmin } from "@/guards";
import { listUsers } from "@/users";
import { InviteForm } from "./invite-form";
import { UserRow } from "./user-row";

export default function UsersPage() {
  return (
    <main className="p-8">
      <Suspense fallback={<p>Loading…</p>}>
        <UsersAdmin />
      </Suspense>
    </main>
  );
}

// Guard first, in the same Suspense child that fetches the user list.
async function UsersAdmin() {
  await requireAdmin();
  const users = await listUsers();
  return (
    <>
      <h1 className="text-3xl font-bold mb-4">Users</h1>
      <InviteForm />
      <table className="text-left">
        <thead>
          <tr>
            <th className="pr-4">Email</th>
            <th className="pr-4">Name</th>
            <th className="pr-4">Role</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <UserRow key={user.id} user={user} />
          ))}
        </tbody>
      </table>
    </>
  );
}
