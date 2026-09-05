"use client";
import { createBrowserClient } from "@supabase/ssr";
import { publicConfig } from "@/lib/config";

let cached: ReturnType<typeof createBrowserClient> | null = null;

/**
 * Tarayıcı istemcisi — tek örnek, her çağrıda yeniden kurulmaz.
 *
 * Ayarlar `NEXT_PUBLIC_*` gömülü değerlerden DEĞİL, sunucunun
 * sayfaya yerleştirdiği `window.__KB_CONFIG` üzerinden okunur.
 * Böylece aynı Docker imajı her ortamda çalışır.
 */
export function supabaseBrowser() {
  if (!cached) {
    const { supabaseUrl, supabaseAnonKey } = publicConfig();
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error(
        "Supabase ayarları bulunamadı. Sunucuda SUPABASE_URL ve " +
        "SUPABASE_ANON_KEY tanımlı olmalı.",
      );
    }
    cached = createBrowserClient(supabaseUrl, supabaseAnonKey);
  }
  return cached;
}
