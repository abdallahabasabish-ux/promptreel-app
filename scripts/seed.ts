/* Seed script — run: bun scripts/seed.ts */
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";

const db = new PrismaClient();

const PLANS = [
  {
    name: "Free", slug: "free", description: "Try CHAFIKTECH and ship your first reels.",
    priceCents: 0, monthlyGenerations: 10, maxVideoMb: 50, sortOrder: 1, isDefault: true,
    features: JSON.stringify([
      "10 prompt packages per month",
      "1–8 scenes per generation",
      "Reference video up to 50 MB",
      "All admin-enabled prompt languages",
      "Copy, export & share links",
    ]),
  },
  {
    name: "Pro", slug: "pro", description: "For creators publishing every day.",
    priceCents: 1900, monthlyGenerations: 200, maxVideoMb: 300, sortOrder: 2, isDefault: false,
    features: JSON.stringify([
      "200 prompt packages per month",
      "Reference video up to 300 MB",
      "Priority Pro model for complex ideas",
      "Full generation history",
      "Share links & exports",
    ]),
  },
  {
    name: "Studio", slug: "studio", description: "For agencies and production teams.",
    priceCents: 4900, monthlyGenerations: 1000, maxVideoMb: 1024, sortOrder: 3, isDefault: false,
    features: JSON.stringify([
      "1,000 prompt packages per month",
      "Reference video up to 1 GB",
      "Priority Pro model on every run",
      "Volume usage for teams",
      "Priority support",
    ]),
  },
];

const LANGUAGES = [
  { name: "English", nativeName: "English", code: "en", sortOrder: 1 },
  { name: "Arabic", nativeName: "العربية", code: "ar", sortOrder: 2 },
  { name: "French", nativeName: "Français", code: "fr", sortOrder: 3 },
  { name: "Spanish", nativeName: "Español", code: "es", sortOrder: 4 },
  { name: "German", nativeName: "Deutsch", code: "de", sortOrder: 5 },
  { name: "Portuguese", nativeName: "Português", code: "pt", sortOrder: 6 },
  { name: "Turkish", nativeName: "Türkçe", code: "tr", sortOrder: 7 },
];

const SETTINGS: Record<string, unknown> = {
  geminiModelFlash: "gemini-2.5-flash",
  geminiModelPro: "gemini-2.5-pro",
  geminiAutoModel: true,
  emailVerificationRequired: false,
  maintenanceMode: false,
  defaultPlanSlug: "free",
  welcomeMessage: "What do you want to create today?",
};

async function main() {
  console.log("Seeding CHAFIKTECH…");

  for (const plan of PLANS) {
    await db.plan.upsert({
      where: { slug: plan.slug },
      update: {
        name: plan.name, description: plan.description, priceCents: plan.priceCents,
        monthlyGenerations: plan.monthlyGenerations, maxVideoMb: plan.maxVideoMb,
        features: plan.features, sortOrder: plan.sortOrder, isDefault: plan.isDefault,
      },
      create: { ...plan },
    });
  }

  for (const lang of LANGUAGES) {
    await db.promptLanguage.upsert({
      where: { code: lang.code },
      update: { name: lang.name, nativeName: lang.nativeName, sortOrder: lang.sortOrder },
      create: { ...lang },
    });
  }

  for (const [key, value] of Object.entries(SETTINGS)) {
    await db.appSetting.upsert({ where: { key }, update: { value: JSON.stringify(value) }, create: { key, value: JSON.stringify(value) } });
  }

  const adminEmail = (process.env.ADMIN_EMAIL || "admin@chafiktech.com").toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || "ChafikTech@2026";
  const existing = await db.user.findUnique({ where: { email: adminEmail } });
  if (!existing) {
    const studio = await db.plan.findUnique({ where: { slug: "studio" } });
    await db.user.create({
      data: {
        email: adminEmail,
        name: "Chafik Tech Admin",
        passwordHash: hashPassword(adminPassword),
        role: "admin",
        emailVerifiedAt: new Date(),
        planId: studio?.id,
        planPeriodEnd: new Date(Date.now() + 3650 * 24 * 60 * 60 * 1000),
      },
    });
    console.log(`Admin created: ${adminEmail} / ${adminPassword}  (change this in production!)`);
  } else {
    console.log(`Admin exists: ${adminEmail}`);
  }

  console.log("Seed complete.");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
