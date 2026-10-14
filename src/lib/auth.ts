import { SignJWT, jwtVerify } from "jose";
import { cookies, headers } from "next/headers";
import { prisma } from "./prisma";
import bcrypt from "bcryptjs";
import { cache } from "react";

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || "biocell-dev-secret"
);

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: string;
  organizationId: string;
  unitIds: string[];
  mustChangePassword?: boolean;
}

export async function signToken(user: SessionUser, expiresIn = "8h") {
  return new SignJWT({ user })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(expiresIn)
    .sign(SECRET);
}

export async function createSession(user: SessionUser) {
  const token = await signToken(user);

  const cookieStore = await cookies();
  cookieStore.set("session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 8 * 60 * 60,
    path: "/",
  });
}

// Confere o usuário no banco (uma vez por requisição): desativação, troca de função ou de unidades
// valem na hora, sem esperar o token expirar
const loadUser = cache(async (id: string): Promise<SessionUser | null> => {
  const user = await prisma.user.findUnique({ where: { id }, include: { units: { select: { unitId: true } } } });
  if (!user || !user.active) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    organizationId: user.organizationId,
    unitIds: user.units.map((u) => u.unitId),
    mustChangePassword: user.mustChangePassword,
  };
});

export async function getSession(): Promise<SessionUser | null> {
  // App mobile envia "Authorization: Bearer <token>"; o webapp usa o cookie
  const authHeader = (await headers()).get("authorization");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const cookieStore = await cookies();
  const token = bearer || cookieStore.get("session")?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, SECRET);
    const tokenUser = (payload as { user?: SessionUser }).user;
    if (!tokenUser?.id) return null;
    return await loadUser(tokenUser.id);
  } catch {
    return null;
  }
}

export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.delete("session");
}

export async function authenticate(email: string, password: string, { setCookie = true } = {}) {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { units: true },
  });

  if (!user || !user.active) return null;

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return null;

  const sessionUser: SessionUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    organizationId: user.organizationId,
    unitIds: user.units.map((u) => u.unitId),
    mustChangePassword: user.mustChangePassword,
  };

  if (setCookie) await createSession(sessionUser);
  return sessionUser;
}

export const MIN_PASSWORD_LENGTH = 8;

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

// Senha provisória legível (sem caracteres ambíguos como 0/O, 1/l)
export function generateTempPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}
