import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { assertLocale, href } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { getSiteSettings } from "@/lib/settings";
import { getCityOptions } from "@/lib/queries";
import { createAuthedClient } from "@/lib/supabase/server";
import AuthShell from "@/components/auth/AuthShell";
import CompleteProfile from "@/components/auth/CompleteProfile";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return { robots: { index: false } };
}

/**
 * OAuth ile gelen kullanıcıda şehir bilgisi olmaz. Trigger
 * `onboarded_at`i boş bırakır; bu sayfa eksikleri tamamlatır.
 * Zaten tamamlanmışsa hesaba yönlendirir.
 */
export default async function CompleteProfilePage({
  params,
}: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = assertLocale(raw);

  const sb = await createAuthedClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect(href(locale, "login"));

  const { data: profile } = await sb
    .from("my_profile")
    .select("first_name, last_name, city_slug, onboarded_at")
    .maybeSingle();

  if (profile?.onboarded_at) redirect(href(locale, "account"));

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
      title={dict.auth.completeTitle}
      subtitle={dict.auth.completeSub}
    >
      <CompleteProfile
        locale={locale}
        dict={dict}
        cities={cities}
        initialFirst={profile?.first_name ?? ""}
        initialLast={profile?.last_name ?? ""}
        initialCity={profile?.city_slug ?? "istanbul"}
      />
    </AuthShell>
  );
}
