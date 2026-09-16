import type { Metadata } from "next";
import { assertLocale, href } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createPublicClient } from "@/lib/supabase/server";
import Icon from "@/components/ui/Icon";
import VerifiedRedirect from "@/components/auth/VerifiedRedirect";
import Link from "next/link";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return { robots: { index: false } };
}

/**
 * DOĞRULAMA BAĞLANTISI
 *
 * Maildeki bağlantı buraya gelir. Oturum GEREKMEZ: kullanıcı
 * maili başka cihazda açmış olabilir. Token tek kullanımlık ve
 * 15 dakikalık, kimlik yerine geçiyor.
 *
 * Kodu elle girmek isteyen hesap sayfasını kullanır; bu sayfa
 * yalnızca bağlantı yolu.
 */
export default async function VerifyEmailPage({
  params, searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const [{ locale: raw }, q] = await Promise.all([params, searchParams]);
  const locale = assertLocale(raw);
  const dict = await getDictionary(locale);

  let ok = false;
  if (q.token) {
    const sb = createPublicClient();
    const { data } = await sb.rpc("verify_email", { p_token: q.token });
    ok = data === true;
  }

  return (
    <div style={{
      minHeight: "calc(100dvh - 200px)", display: "flex",
      alignItems: "center", justifyContent: "center",
      padding: "28px var(--gut)", textAlign: "center",
    }}>
      <div style={{ maxWidth: 420 }}>
        <span style={{
          width: 68, height: 68, borderRadius: 999, margin: "0 auto 20px",
          display: "grid", placeItems: "center",
          background: ok ? "rgba(48,209,88,.14)" : "rgba(229,72,77,.12)",
          color: ok ? "#30D158" : "#E5484D",
          animation: ok ? "kbPop .45s cubic-bezier(.32,.72,0,1)" : undefined,
        }}>
          <Icon name={ok ? "verified" : "warn"} size={32} />
        </span>

        <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-.02em" }}>
          {ok ? dict.profile.verifiedTitle : dict.common.error}
        </h1>
        <p style={{ fontSize: 15, color: "var(--mu)", marginTop: 10, lineHeight: 1.6 }}>
          {ok ? dict.profile.verifiedSub : dict.profile.verifyFailed}
        </p>

        {ok ? (
          <VerifiedRedirect
            to={href(locale, "home")}
            label={dict.profile.redirecting}
          />
        ) : (
          <Link href={href(locale, "account")} style={{
            display: "inline-flex", marginTop: 22, padding: "13px 24px",
            borderRadius: 13, background: "var(--tx)", color: "var(--bg)",
            fontSize: 15, fontWeight: 700,
          }}>{dict.nav.account}</Link>
        )}
      </div>

      <style>{`
        @keyframes kbPop {
          from { transform: scale(.6); opacity: 0 }
          to   { transform: scale(1);  opacity: 1 }
        }
      `}</style>
    </div>
  );
}
