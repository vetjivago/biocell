import { redirect } from "next/navigation";

// O pedido agora é feito pela loja (vitrine + carrinho)
export default function NovoPedidoPage() {
  redirect("/pedidos/loja");
}
