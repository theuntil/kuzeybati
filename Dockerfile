# ############################################################
#  ⚠ DİSK KULLANIMI
#
#  Önce iki ayrı katmanda `node_modules` kopyalanıyordu:
#    deps katmanı  → ~500 MB
#    build katmanı → aynı 500 MB'ın KOPYASI
#  Dokploy sunucusunda disk dolunca şu hata alınıyordu:
#    failed to copy files: copy file range failed: no space left on device
#
#  Çözüm: `deps` katmanı kaldırıldı. Bağımlılıklar doğrudan
#  build katmanında kuruluyor — bir kopya yerine sıfır kopya.
#  Önbellek yine çalışıyor: `package*.json` değişmedikçe
#  `npm ci` adımı yeniden çalışmıyor.
# ############################################################

# ---- derleme ----
FROM node:22-alpine AS build
WORKDIR /app

# Önce yalnızca manifest: kaynak değişince npm ci tekrar çalışmasın
COPY package*.json ./
RUN npm ci --no-audit --no-fund

COPY . .

# `public` klasörü boşsa git onu taşımaz ve
# "COPY /app/public: not found" hatası alınır.
RUN mkdir -p public

# ┌─ NEXT_PUBLIC_* DERLEME ANINDA GEREKİYOR ⚠️ ──────────────┐
# │ Bu değişkenler tarayıcı paketine GÖMÜLÜYOR; çalışma      │
# │ anında verilmeleri işe yaramıyor. Compose `args` ile     │
# │ geçiriyor.                                                  │
# │                                                              │
# │ Eksikse uygulama derleniyor ama Supabase'e bağlanamıyor  │
# │ ve sayfa boş açılıyor.                                      │
# └──────────────────────────────────────────────────────────────┘
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_CDN_BASE
ARG NEXT_PUBLIC_SITE_URL

ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_CDN_BASE=$NEXT_PUBLIC_CDN_BASE \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# Derleme bitti; standalone çıktı zaten kendi node_modules'ünü
# taşıyor. Kalanı sil — katman boyutu düşsün.
RUN rm -rf node_modules

# ---- çalıştırma ----
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0

COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static

USER node
EXPOSE 3000
CMD ["node", "server.js"]
