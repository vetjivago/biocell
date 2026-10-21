import { authenticate, signToken } from "@/lib/auth";
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

  // "login" = e-mail ou celular; versões antigas do app ainda mandam "email"
  const { login, email, password, client } = await request.json();
  const identifier = typeof login === "string" ? login : typeof email === "string" ? email : "";
  const isMobile = client === "mobile";

  if (!identifier.trim() || !password) {
    return Response.json({ error: "Informe o e-mail ou celular e a senha" }, { status: 400 });
  }

  const user = await authenticate(identifier, password, { setCookie: !isMobile });
  if (!user) {
    return Response.json({ error: "Credenciais inválidas" }, { status: 401 });
  }

  // App mobile recebe o token no corpo (guardado no SecureStore do aparelho)
  if (isMobile) {
    if (user.mustChangePassword) {
      return Response.json({ error: "Primeiro acesso: crie sua senha pessoal pelo site (biocell-mu.vercel.app) e depois entre no app." }, { status: 403 });
    }
    return Response.json({ user, token: await signToken(user, "7d") });
  }

  return Response.json({ user });
}
