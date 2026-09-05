/**
 * SUPABASE HATALARININ TÜRKÇESİ
 *
 * Supabase hataları İngilizce döner ("Invalid login credentials").
 * Kullanıcıya ham İngilizce mesaj göstermek kabul edilemez.
 *
 * Eşleşme mesaj METNİNE göre yapılıyor çünkü Supabase kod
 * alanını her hatada doldurmuyor. Bilinmeyen bir hata gelirse
 * genel mesaj gösterilir; ham metin ASLA gösterilmez.
 */
const MAP: { match: RegExp; tr: string }[] = [
  { match: /invalid login credentials/i,
    tr: "E-posta veya şifre hatalı." },
  { match: /email not confirmed/i,
    tr: "E-posta adresin henüz doğrulanmamış." },
  { match: /user already registered|already been registered/i,
    tr: "Bu e-posta adresiyle zaten bir hesap var." },
  { match: /password should be at least/i,
    tr: "Şifre en az 8 karakter olmalı." },
  { match: /unable to validate email|invalid email/i,
    tr: "E-posta adresi geçersiz." },
  { match: /email rate limit|over_email_send_rate_limit/i,
    tr: "Çok fazla deneme yaptın. Birkaç dakika sonra tekrar dene." },
  { match: /for security purposes|you can only request this after/i,
    tr: "Çok sık denedin. Biraz bekleyip tekrar dene." },
  { match: /signups not allowed|signup is disabled/i,
    tr: "Yeni kayıtlar şu an kapalı." },
  { match: /token has expired|invalid token/i,
    tr: "Bağlantının süresi dolmuş. Yeni bir tane iste." },
  { match: /network|fetch failed|failed to fetch/i,
    tr: "Bağlantı kurulamadı. İnternetini kontrol et." },
  { match: /weak password/i,
    tr: "Şifre çok basit. Daha güçlü bir şifre seç." },
  { match: /same password/i,
    tr: "Yeni şifre eskisiyle aynı olamaz." },
  { match: /provider is not enabled/i,
    tr: "Bu giriş yöntemi şu an kullanılamıyor." },
];

export function authError(err: unknown): string {
  const raw =
    typeof err === "string" ? err
    : err instanceof Error ? err.message
    : typeof err === "object" && err && "message" in err
      ? String((err as { message: unknown }).message)
      : "";

  for (const { match, tr } of MAP) {
    if (match.test(raw)) return tr;
  }
  // Bilinmeyen hata: ham İngilizce metni GÖSTERME
  return "Bir şeyler ters gitti. Lütfen tekrar dene.";
}
