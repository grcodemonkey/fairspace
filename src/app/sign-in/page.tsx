import { redirect } from "next/navigation";
import { CHECK_EMAIL_URL, signIn } from "@/auth";

export default function SignInPage() {
  async function sendLink(formData: FormData) {
    "use server";
    const email = formData.get("email");
    // A forged post with no email would make Auth.js throw; answer it like any other request.
    if (typeof email !== "string" || !email.trim()) redirect(CHECK_EMAIL_URL);
    // Object form: with FormData, next-auth reads redirectTo from the form and ignores a third argument.
    // redirect: false, then one redirect for every email: Auth.js's own redirect URL differs for known emails.
    await signIn("nodemailer", { email, redirectTo: "/admin", redirect: false });
    redirect(CHECK_EMAIL_URL);
  }

  return (
    <main className="p-8 max-w-sm">
      <h1 className="text-3xl font-bold mb-4">Sign in</h1>
      <form action={sendLink} className="flex flex-col gap-3">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="border rounded px-3 py-2"
        />
        <button type="submit" className="border rounded px-3 py-2 font-semibold">
          Email me a sign-in link
        </button>
      </form>
    </main>
  );
}
