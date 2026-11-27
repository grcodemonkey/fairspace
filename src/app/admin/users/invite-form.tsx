"use client";

import { useActionState } from "react";
import { inviteAction } from "./actions";

export function InviteForm() {
  const [state, action, pending] = useActionState(inviteAction, {});
  return (
    <form action={action} className="flex flex-wrap items-end gap-3 mb-6">
      <div className="flex flex-col gap-1">
        <label htmlFor="invite-email">Email</label>
        <input id="invite-email" name="email" type="email" required className="border rounded px-3 py-2" />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="invite-role">Role</label>
        <select id="invite-role" name="role" defaultValue="editor" className="border rounded px-3 py-2">
          <option value="editor">Editor</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      <button type="submit" disabled={pending} className="border rounded px-3 py-2 font-semibold">
        Invite
      </button>
      <p aria-live="polite" className={state.error ? "text-danger" : ""}>
        {state.error ?? state.message}
      </p>
    </form>
  );
}
