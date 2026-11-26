import { signIn } from "@/auth";

export default function SignInPage() {
  async function sendLink(formData: FormData) {
    "use server";
    // Object form: with FormData, next-auth reads redirectTo from the form and ignores a third argument.
    await signIn("nodemailer", { email: formData.get("email"), redirectTo: "/admin" });
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
