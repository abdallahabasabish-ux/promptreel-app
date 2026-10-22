/* One-off: align the seeded admin password with the rebranded default (ChafikTech@2026). */
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";

const db = new PrismaClient();

async function main() {
  const email = (process.env.ADMIN_EMAIL || "admin@chafiktech.com").toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "ChafikTech@2026";
  const admin = await db.user.findUnique({ where: { email } });
  if (!admin) {
    console.log(`No admin found for ${email} — nothing to do.`);
    return;
  }
  await db.user.update({ where: { email }, data: { passwordHash: hashPassword(password) } });
  // Stale sessions may hold cached credentials; invalidate them for safety.
  await db.session.deleteMany({ where: { userId: admin.id } });
  console.log(`Admin password updated for ${email}.`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
