import "server-only";
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { publicConfig } from "@/lib/config";

function env(): { url: string; anon: string } {
  const { supabaseUrl: url, supabaseAnonKey: anon } = publicConfig();
  if (!url || !anon) {
    throw new Error(
      "SUPABASE_URL ve SUPABASE_ANON_KEY tanımlı değil. " +
      "Dokploy → Environment (ya da .env) doldurulmalı.",
    );
  }
  return { url, anon };
}

/**
 * Oturumsuz okuma istemcisi.
 *
 * Herkese açık içerik için kullanılır ve çerez OKUMAZ — bu sayede
 * sayfalar statik render edilip ISR ile önbelleklenebilir. Çereze
 * dokunan bir istemci kullanılsaydı Next her isteği dinamik sayar
 * ve önbellek tamamen devre dışı kalırdı.
 */
export function createPublicClient() {
  const { url, anon } = env();
  return createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "x-application-name": "kuzeybati-web" } },
  });
}

/**
 * Oturumlu istemci — yorum, beğeni ve hesap sayfaları için.
 * Çerez okuduğu için bunu kullanan sayfa dinamik olur.
 */
export async function createAuthedClient() {
  const { url, anon } = env();
  const store = await cookies();

  return createServerClient(url, anon, {
    cookies: {
      getAll() {
        return store.getAll();
      },
      setAll(list: { name: string; value: string; options: CookieOptions }[]) {
        try {
          for (const { name, value, options } of list) {
            store.set(name, value, options);
          }
        } catch {
          // Server Component içinden çağrıldığında yazma engellenir;
          // oturum yenilemesini middleware zaten yapıyor.
        }
      },
    },
  });
}
