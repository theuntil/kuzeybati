import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { assertLocale, href } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { getSiteSettings } from "@/lib/settings";
import { getCityOptions } from "@/lib/queries";
import { createAuthedClient } from "@/lib/supabase/server";
import AuthShell from "@/components/auth/AuthShell";
import AuthForm from "@/components/auth/AuthForm";
import Link from "next/link";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const dict = await getDictionary(assertLocale(locale));
  return { title: dict.auth.signup, robots: { index: false } };
}

export default async function SignupPage({
  params,
}: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = assertLocale(raw);

  const sb = await createAuthedClient();
  const { data: auth } = await sb.auth.getUser();
  if (auth.user) redirect(href(locale, "account"));

  const [dict, settings, cities] = await Promise.all([
    getDictionary(locale),
    getSiteSettings(),
    getCityOptions(),
  ]);

  return (
    <AuthShell
      settings={settings}
      locale={locale}
      dict={dict}
      title={dict.auth.signupTitle}
      subtitle={dict.auth.signupSub}
      footer={
        <>
          {dict.auth.hasAccount}{" "}
          <Link href={href(locale, "login")} style={{ color: "var(--tx)", fontWeight: 700, textDecoration: "underline", textUnderlineOffset: 3 }}>
            {dict.auth.login}
          </Link>
        </>
      }
    >
      <AuthForm
        mode="signup"
        locale={locale}
        dict={dict}
        cities={cities}
        registrationEnabled={settings.registration_enabled}
        registrationMessage={settings.registration_message}
      />
    </AuthShell>
  );
}
