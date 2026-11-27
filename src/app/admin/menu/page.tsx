import { Suspense } from "react";
import { requireAdmin } from "@/guards";
import { getMenuForEdit } from "@/menu";
import { MenuForm } from "./menu-form";

export default function MenuPage() {
  return (
    <main className="p-8">
      <Suspense fallback={<p>Loading…</p>}>
        <MenuAdmin />
      </Suspense>
    </main>
  );
}

// Guard first, in the same Suspense child that fetches the menu and the page list.
async function MenuAdmin() {
  await requireAdmin();
  const { items, pages } = await getMenuForEdit();
  return (
    <>
      <h1 className="text-3xl font-bold mb-4">Menu</h1>
      <MenuForm initial={items} pages={pages} />
    </>
  );
}
