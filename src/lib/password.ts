import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

const N = 16384, R = 8, P = 1, KEYLEN = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, KEYLEN, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${salt.toString("hex")}$${derived.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string | null | undefined): boolean {
  if (!stored) return false;
  try {
    const parts = stored.split("$");
    if (parts.length !== 6 || parts[0] !== "scrypt") return false;
    const n = parseInt(parts[1], 10), r = parseInt(parts[2], 10), p = parseInt(parts[3], 10);
    const salt = Buffer.from(parts[4], "hex");
    const expected = Buffer.from(parts[5], "hex");
    const derived = scryptSync(password, salt, expected.length, { N: n, r, p });
    return timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

export function passwordIssues(password: string): string[] {
  const issues: string[] = [];
  if (password.length < 8) issues.push("at least 8 characters");
  if (!/[a-zA-Z]/.test(password)) issues.push("one letter");
  if (!/[0-9]/.test(password)) issues.push("one number");
  return issues;
}
