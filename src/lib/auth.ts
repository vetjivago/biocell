import { SignJWT, jwtVerify } from "jose";
import { cookies, headers } from "next/headers";
import { prisma } from "./prisma";
import bcrypt from "bcryptjs";

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

export async function getSession(): Promise<SessionUser | null> {
  // App mobile envia "Authorization: Bearer <token>"; o webapp usa o cookie
  const authHeader = (await headers()).get("authorization");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const cookieStore = await cookies();
  const token = bearer || cookieStore.get("session")?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, SECRET);
    return (payload as { user: SessionUser }).user;
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
  };

  if (setCookie) await createSession(sessionUser);
  return sessionUser;
}
