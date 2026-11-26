"use server";

import { refresh } from "next/cache";
import { type Role, signIn } from "@/auth";
import { userRole } from "@/db/schema";
import { requireAdmin } from "@/guards";
import { changeRole, inviteUser, removeUser } from "@/users";

export type ActionState = { error?: string; message?: string };

const isRole = (value: unknown): value is Role => userRole.enumValues.includes(value as Role);
const idFrom = (formData: FormData) => {
  const id = formData.get("id");
  return typeof id === "string" && id ? id : null;
};

export async function inviteAction(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const raw = formData.get("email");
  const email = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  const role = formData.get("role");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email." };
  if (!isRole(role)) return { error: "Choose a role." };
  const result = await inviteUser(email, role);
  if (result.error) return result;
  // The normal magic-link email. redirect: false keeps the admin on this page; the admin's session cookie is not touched.
  try {
    await signIn("nodemailer", { email, redirectTo: "/admin", redirect: false });
  } catch {
    // The user row exists now: show it, and tell the admin how the user can still sign in.
    refresh();
    return { error: "Invited, but the email failed. Ask them to sign in at /sign-in." };
  }
  refresh();
  return { message: `Invited ${email}.` };
}

export async function changeRoleAction(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = idFrom(formData);
  const role = formData.get("role");
  if (!id || !isRole(role)) return { error: "Invalid request." };
  const result = await changeRole(id, role);
  if (!result.error) refresh();
  return result;
}

export async function removeAction(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = idFrom(formData);
  if (!id) return { error: "Invalid request." };
  const result = await removeUser(id);
  if (!result.error) refresh();
  return result;
}
