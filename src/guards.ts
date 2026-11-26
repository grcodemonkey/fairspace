import { forbidden, redirect } from "next/navigation";
import { auth } from "@/auth";

// Both guards read cookies: never call them inside "use cache"; put the caller behind <Suspense>.

/** Any signed-in user. Call in every page, server action and route handler. Layouts and the UI are not a guard. */
export async function requireUser() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  return session.user;
}

/** Admins only (403 for editors). Call in every page, server action and route handler. Layouts and the UI are not a guard. */
export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "admin") forbidden();
  return user;
}
