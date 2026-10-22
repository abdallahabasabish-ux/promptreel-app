import { cookies } from "next/headers";
import { createHash, randomBytes } from "crypto";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/api";

export const SESSION_COOKIE = "chafiktech_session";
const SESSION_DAYS = 30;

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.session.create({ data: { tokenHash: sha256(token), userId, expiresAt } });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.session.deleteMany({ where: { tokenHash: sha256(token) } });
  }
  store.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

export async function destroyAllSessions(userId: string): Promise<void> {
  await db.session.deleteMany({ where: { userId } });
}

export type SafeUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  emailVerified: boolean;
  theme: string;
  defaultSceneCount: number;
  defaultLanguageCode: string;
  planId: string | null;
  planName: string | null;
  planPeriodEnd: string | null;
  createdAt: string;
};

export async function getSessionUser() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: { include: { plan: true } } },
  });
  if (!session) return null;
  if (session.expiresAt < new Date()) {
    await db.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  const u = session.user;
  if (u.status === "banned") return null;
  return u;
}

export function toSafeUser(u: {
  id: string; email: string; name: string; role: string; status: string;
  emailVerifiedAt: Date | null; theme: string; defaultSceneCount: number;
  defaultLanguageCode: string; planId: string | null; planPeriodEnd: Date | null;
  createdAt: Date;
  plan?: { name: string } | null;
}): SafeUser {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    status: u.status,
    emailVerified: !!u.emailVerifiedAt,
    theme: u.theme,
    defaultSceneCount: u.defaultSceneCount,
    defaultLanguageCode: u.defaultLanguageCode,
    planId: u.planId,
    planName: u.plan?.name ?? null,
    planPeriodEnd: u.planPeriodEnd ? u.planPeriodEnd.toISOString() : null,
    createdAt: u.createdAt.toISOString(),
  };
}

export async function requireUser() {
  const user = await getSessionUser();
  if (!user) throw new ApiError(401, "unauthorized", "Please sign in to continue.");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "admin") throw new ApiError(403, "forbidden", "Admin access required.");
  return user;
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("hex");
}
