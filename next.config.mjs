/** @type {import('next').NextConfig} */
const cdn = process.env.NEXT_PUBLIC_CDN_BASE ?? "";
const cdnHost = cdn ? new URL(cdn).hostname : null;

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,

  // Medya zaten bot tarafında AVIF'e çevrildi ve boyutlandırıldı.
  // Next'in optimizer'ından geçirmek ikinci kez sıkıştırma demek:
  // kalite düşer, sunucu CPU yakar. Doğrudan CDN'den servis ediyoruz.
  images: {
    unoptimized: true,
    remotePatterns: cdnHost
      ? [{ protocol: "https", hostname: cdnHost }]
      : [],
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },

          /*
           * ⚠ HSTS — tarayıcı bir daha HTTP denemesin.
           * Olmadığında ilk istek düz HTTP gidiyor ve aradaki
           * biri (açık wifi, ISP) oturum çerezini görebiliyor.
           * `preload` listesine girmeden önce tüm alt alan
           * adlarının HTTPS olduğundan emin ol.
           */
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains",
          },

          /*
           * Kullanılmayan tarayıcı yetkileri kapatılıyor.
           * Bir XSS kaçarsa kamera/mikrofon/konuma erişemesin.
           */
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(self), payment=()",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(self)",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
