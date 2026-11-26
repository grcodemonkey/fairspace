// Same text for known and unknown emails, so the page does not show which emails have an account.
export default function CheckEmailPage() {
  return (
    <main className="p-8 max-w-sm">
      <h1 className="text-3xl font-bold mb-4">Check your email</h1>
      <p>If an account exists for that address, we sent it a sign-in link.</p>
    </main>
  );
}
