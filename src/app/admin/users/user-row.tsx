"use client";

import { useActionState } from "react";
import type { Role } from "@/auth";
import { changeRoleAction, removeAction } from "./actions";

type User = { id: string; email: string | null; name: string | null; role: Role };

export function UserRow({ user }: { user: User }) {
  const [roleState, roleAction, rolePending] = useActionState(changeRoleAction, {});
  const [removeState, remove, removePending] = useActionState(removeAction, {});
  const other = user.role === "admin" ? "editor" : "admin";
  const error = roleState.error ?? removeState.error;
  return (
    <tr className="border-t align-top">
      <td className="py-2 pr-4">{user.email}</td>
      <td className="py-2 pr-4">{user.name}</td>
      <td className="py-2 pr-4">{user.role === "admin" ? "Admin" : "Editor"}</td>
      <td className="py-2">
        <div className="flex gap-2">
          <form action={roleAction}>
            <input type="hidden" name="id" value={user.id} />
            <input type="hidden" name="role" value={other} />
            <button type="submit" disabled={rolePending} className="border rounded px-2 py-1">
              Change to {other}
            </button>
          </form>
          <form
            action={remove}
            onSubmit={(e) => {
              if (!confirm(`Remove ${user.email}? They are signed out at once.`)) e.preventDefault();
            }}
          >
            <input type="hidden" name="id" value={user.id} />
            <button type="submit" disabled={removePending} className="border rounded px-2 py-1">
              Remove
            </button>
          </form>
        </div>
        <p aria-live="polite" className="text-danger">
          {error}
        </p>
      </td>
    </tr>
  );
}
