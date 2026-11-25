import { getSession } from "@/lib/auth";
import { notFound } from "next/navigation";
import { canRequestPurchases } from "@/lib/purchase-orders";
import { storeProduct } from "@/lib/store";
import StoreNav from "../../StoreNav";
import ProductDetail from "./ProductDetail";

export default async function ProdutoPage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await getSession();
  if (!session) return null;
  if (!canRequestPurchases(session.role)) notFound();
  const { slug } = await params;
  const product = storeProduct(slug);
  if (!product) notFound();
  return (
    <div>
      <StoreNav userId={session.id} canBuy />
      <ProductDetail userId={session.id} productId={product.id} />
    </div>
  );
}
