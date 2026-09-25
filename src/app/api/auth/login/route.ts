import { authenticate } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const limit = checkRateLimit(`login:${ip}`);

  if (!limit.allowed) {
    return Response.json(
      { error: "Muitas tentativas. Tente novamente mais tarde." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)) },
      }
    );
  }

  const { email, password } = await request.json();

  if (!email || !password) {
    return Response.json({ error: "Email e senha são obrigatórios" }, { status: 400 });
  }

  const user = await authenticate(email, password);
  if (!user) {
    return Response.json({ error: "Credenciais inválidas" }, { status: 401 });
  }

  return Response.json({ user });
}
