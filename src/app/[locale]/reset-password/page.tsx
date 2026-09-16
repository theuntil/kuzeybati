import type { Metadata } from "next";
import { assertLocale, href } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { getSiteSettings } from "@/lib/settings";
import AuthShell from "@/components/auth/AuthShell";
import ResetPassword from "@/components/auth/ResetPassword";
import Link from "next/link";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return { robots: { index: false } };
}

export default async function ResetPasswordPage({
  params,
}: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = assertLocale(raw);
  const [dict, settings] = await Promise.all([
    getDictionary(locale), getSiteSettings(),
  ]);

  return (
    <AuthShell
      settings={settings}
      locale={locale}
      dict={dict}
      title={dict.profile.resetTitle}
      subtitle={dict.profile.resetSub}
      footer={
        <Link href={href(locale, "login")} style={{ color: "var(--ac)", fontWeight: 700 }}>
          {dict.auth.login}
        </Link>
      }
    >
      <ResetPassword locale={locale} dict={dict} />
    </AuthShell>
  );
}
