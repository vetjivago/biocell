import { NextResponse, type NextRequest } from "next/server";

// Repassa o caminho e o método para o servidor: getSession usa para limitar telas e alterações
// de perfis restritos (ex.: Comercial só consulta)
export function proxy(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set("x-pathname", request.nextUrl.pathname);
  headers.set("x-method", request.method);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|brand/|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)"],
};
