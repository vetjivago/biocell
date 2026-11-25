import { getSession } from "@/lib/auth";
import { notFound } from "next/navigation";
import { canRequestPurchases } from "@/lib/purchase-orders";
import StoreNav from "../StoreNav";
import StoreFront from "./StoreFront";

// Vitrine da loja (mesmo catálogo da loja BIO CELL no Sults)
export default async function LojaPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const session = await getSession();
  if (!session) return null;
  if (!canRequestPurchases(session.role)) notFound();
  const { q = "" } = await searchParams;
  return (
    <div>
      <StoreNav userId={session.id} canBuy />
      <StoreFront key={q} userId={session.id} initialQuery={q} />
    </div>
  );
}
