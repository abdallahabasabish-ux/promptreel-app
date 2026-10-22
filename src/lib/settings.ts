import { db } from "@/lib/db";

export type AppSettings = {
  geminiModelFlash: string;
  geminiModelPro: string;
  geminiAutoModel: boolean;
  emailVerificationRequired: boolean;
  maintenanceMode: boolean;
  defaultPlanSlug: string;
  welcomeMessage: string;
};

const DEFAULTS: AppSettings = {
  geminiModelFlash: "gemini-2.5-flash",
  geminiModelPro: "gemini-2.5-pro",
  geminiAutoModel: true,
  emailVerificationRequired: false,
  maintenanceMode: false,
  defaultPlanSlug: "free",
  welcomeMessage: "What do you want to create today?",
};

export async function getSettings(): Promise<AppSettings> {
  const rows = await db.appSetting.findMany();
  const merged: Record<string, unknown> = { ...DEFAULTS };
  for (const row of rows) {
    try {
      merged[row.key] = JSON.parse(row.value);
    } catch {
      // ignore malformed values, keep default
    }
  }
  return merged as AppSettings;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await db.appSetting.upsert({
    where: { key },
    update: { value: JSON.stringify(value) },
    create: { key, value: JSON.stringify(value) },
  });
}

export type FeatureFlags = {
  googleOAuth: boolean;
  stripe: boolean;
  smtp: boolean;
  exposeDevLinks: boolean;
  emailVerificationRequired: boolean;
  maintenanceMode: boolean;
};

export async function getFeatureFlags(): Promise<FeatureFlags> {
  const settings = await getSettings();
  return {
    googleOAuth: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    stripe: !!process.env.STRIPE_SECRET_KEY,
    smtp: !!(process.env.SMTP_HOST && process.env.SMTP_USER),
    exposeDevLinks: process.env.EXPOSE_DEV_AUTH_LINKS === "1" || process.env.NODE_ENV !== "production",
    emailVerificationRequired: settings.emailVerificationRequired,
    maintenanceMode: settings.maintenanceMode,
  };
}
