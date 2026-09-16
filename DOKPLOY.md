# Dokploy Kurulumu

## 1 · Uygulama tipi

```
Application Type : Compose
Compose Type     : docker-compose
Compose File     : ./docker-compose.yml
```

## 2 · Environment sekmesine gir

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_CDN_BASE=https://medya.kuzeybatihaber.com.tr
NEXT_PUBLIC_SITE_URL=https://kuzeybatihaber.com.tr

SUPABASE_URL=
SUPABASE_ANON_KEY=
SITE_URL=https://kuzeybatihaber.com.tr
CDN_BASE=https://medya.kuzeybatihaber.com.tr

S3_ENDPOINT=
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_BUCKET=haber-medya

MAIL_API_URL=
MAIL_API_KEY=

SKOR_API_URL=
SKOR_API_KEY=

PIYASA_API_URL=https://piyasa.rovandcloud.com
PIYASA_API_KEY=

REVALIDATE_SECRET=
PRAYER_METHOD=13
```

## ⚠ `NEXT_PUBLIC_*` HEM ÜSTTE HEM ALTTA

Bu dört değişken hem `build.args` hem `environment` altında.
Next.js `NEXT_PUBLIC_` önekli değerleri **derleme sırasında**
koda gömüyor; yalnızca çalışma anında verilirse tarayıcı
tarafında boş kalıyor ve sayfa boş açılıyor.

## ⚠ `environment` LİSTESİ BEYAZ LİSTEDİR

Dokploy'un Environment sekmesine girdiğin bir değişken,
`docker-compose.yml` içindeki `environment` bloğunda yazmıyorsa
konteynere **ulaşmıyor**. Yeni değişken eklerken oraya da ekle.

Piyasa bölümünün boş kalmasının sebebi buydu.

## 3 · Domain

```
Host : kuzeybatihaber.com.tr
Port : 3000
HTTPS: açık (Let's Encrypt)
```

## ⚠ PORT YAYINLANMIYOR

`ports: 3000:3000` kaldırıldı. Sunucunun 3000 portunu işgal
ediyordu; aynı VPS'te başka bir servis o portu tutuyorsa dağıtım
şu hatayla düşüyor:

```
Bind for 0.0.0.0:3000 failed: port is already allocated
```

Dokploy önünde Traefik var; konteynere kendi ağı üzerinden
ulaşıyor. `expose` yalnızca Docker ağı içinde görünür kılıyor,
internetten doğrudan erişilemiyor.

## ⚠ TRAEFIK ETİKETİ ELLE EKLENMİYOR

Dokploy, Domains sekmesinden alan adı tanımlandığında Traefik
etiketlerini **kendisi** ekliyor.

Elle etiket eklemek aynı alan adı için ikinci bir rota kuruyor.
Traefik eşit öncelikli iki rota görünce hangi servise gideceğini
çözemiyor:

```
404 page not found
```

Alan adı yönetimi tek yerden: **Dokploy → Domains**.

## ⚠ AMA `traefik.enable` ŞART

Traefik `exposedByDefault: false` ile çalışıyor — bu etiket
olmayan konteyneri hiç görmüyor. Dokploy rota etiketlerini
ekliyor ama bunu eklemiyor.

Etiketsizken belirti şu: Traefik günlüğü **boş**, her istek 404.
Hata mesajı çıkmadığı için sebebi anlaşılmıyor.

```yaml
labels:
  traefik.enable: "true"
```

Yalnızca bu satır. Rota etiketlerini elle eklersen Dokploy'un
eklediğiyle çakışır.

## ⚠ `dokploy-network` DIŞ AĞ

Servis bu ağa katılmazsa Traefik onu bulamıyor ve alan adı
tanımlı olsa bile **502** dönüyor. Ağı Dokploy kendisi kuruyor;
`external: true` bu yüzden.

## Rota kurulmuş mu

```bash
docker inspect <konteyner-adi> --format '{{json .Config.Labels}}' \
  | tr ',' '\n' | grep traefik.http.routers
```

Dokploy'un eklediği satırlar görünmeli. Aynı alan adı için
birden çok rota varsa çakışma vardır — elle eklenmiş etiketleri
kaldır.

## Sertifika alınmış mı

```bash
docker exec dokploy-traefik cat /etc/traefik/acme.json | grep -c kuzeybatihaber
```

`0` dönüyorsa Let's Encrypt doğrulaması başarısız. En yaygın iki
sebep: Cloudflare'de Proxied açık, ya da 80 portu kapalı.

## Port çakışması hâlâ sürerse

Hangi konteynerin tuttuğunu bul:

```bash
docker ps --format "{{.Names}}\t{{.Ports}}" | grep 3000
```

Eski bir dağıtım kalmışsa sil:

```bash
docker rm -f <konteyner-adi>
```

## 4 · Kaynak sınırları

```
cpus: 4      memory: 6G
```

Sunucunun tamamı bu projeye ayrıldığı için geniş bırakıldı.
Bot ve mail servisi aynı VPS'teyse düşür.

## Sağlık denetimi

`/api/deprem` kullanılıyor — anahtarsız çalışan tek uç.
Anahtar isteyen bir uç seçilseydi (`/api/markets` gibi) anahtar
eksikken 503 dönüp konteyner sürekli yeniden başlardı.
