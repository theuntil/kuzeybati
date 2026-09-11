# Kuzeybatı Haber — Site (Next.js 15)

Haberleri Supabase'den okur, medyayı Cloudflare R2/CDN'den servis eder.
**Feed'e hiç dokunmaz, `service_role` anahtarı taşımaz.** Yazma işleri
haber botunda ve AI servisinde.

Dört dil: **Türkçe (ana) · English · العربية · Русский**
Arapça sağdan sola (`dir="rtl"`) render edilir.

---

## Hızlı başlangıç

```bash
# 1. Supabase'de SIRAYLA çalıştır (SQL Editor)
#    TAM_KURULUM.sql           → ana şema (bot deposunda)
#    yama-19-site.sql          → ayarlar, menü, yorum, beğeni, görüntülenme
#    yama-20-bulten-reklam.sql → bülten aboneleri, reklam alanları
#
#    Üçü de gerçek PostgreSQL 16 üzerinde baştan sona test edildi:
#    sıfır hata, tekrar çalıştırılabilir (idempotent).

# 2. Ortam değişkenleri
cp .env.example .env    # 5 değer doldur

# 3. Çalıştır
npm install
npm run dev             # http://localhost:3000
npm run typecheck       # tip kontrolü
npm run build           # üretim derlemesi
```

### `.env`

| Değişken | Ne |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | Kanonik adres (sitemap ve OG için) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase proje adresi |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **anon** anahtar — RLS korur |
| `NEXT_PUBLIC_CDN_BASE` | Bot'un `CDN_BASE` değeriyle **birebir aynı** |
| `REVALIDATE_SECRET` | Bot'un ISR tazeleme için kullanacağı sır |

> ⚠️ `SUPABASE_SERVICE_ROLE_KEY` bu projeye **asla** girmez. RLS'i
> bypass eder ve `NEXT_PUBLIC_*` değişkenleri tarayıcıya gömülür.

---

## URL şeması

```
Türkçe (ön eksiz)          Diğer diller
/                          /en  /ar  /ru
/haber/{slug}              /en/news/{slug}
/kategori/{slug}           /en/category/{slug}
/sehir/{slug}              /en/city/{slug}
/arama?q=                  /en/search?q=
/video                     /en/video
/hizmetler                 /en/services
/giris  /kayit  /hesabim   /en/login  /en/signup  /en/account
/sayfa/{slug}              /en/page/{slug}
```

Yol parçaları dile göre çevrilir; `src/middleware.ts` bunları kanonik
segmentlere (`news`, `category`, `city`…) çevirip App Router'a verir.
Kanonik adı doğrudan yazan biri (`/city`) **308 ile** doğru adrese
(`/sehir`) yönlendirilir — aynı içerik iki adresten açılmasın diye.

Link üretmenin tek yolu `href(locale, segment, slug)`. Elle string
birleştirme yapma; dil ön ekini o fonksiyon hallediyor.

---

## Veri katmanı

Okuma **her zaman güvenli görünümlerden**, ham tablodan değil:

| Görünüm | İçerik |
|---|---|
| `public_articles` | Yayındaki haberler, kategori/şehir/kaynak join'li |
| `public_media` | CDN yolu var, token'lı kaynak adres yok |
| `public_site_settings` | Ayarların herkese açık kısmı |
| `public_nav` | Menü, kategori rengi çözülmüş |
| `public_comments` | Sadece onaylı yorumlar + yazar |
| `public_article_stats` | Okunma / beğeni / yorum sayaçları |
| `public_ads` | Aktif ve tarihi geçerli reklamlar |

Medya URL'i **istemcide** üretilir — DB'de tam URL yok:

```
${CDN_BASE}/${storage_key}/{thumb|card|full}.avif
${CDN_BASE}/${storage_key}/video.mp4
${CDN_BASE}/${poster_key}-card.avif
```

CDN alan adı değişirse tek env değişkeni güncellenir.

### Çeviri kuralı

İstenen dilde `status='ok'` çeviri varsa başlık, özet ve gövde ondan
gelir. **Yoksa Türkçe gösterilir ve okura söylenir.** Sessizce Türkçe
göstermek okuru yanıltırdı. AI servisinin çeviri eşiği şu an 8 —
yalnızca ulusal manşetlik haberler çevriliyor.

---

## Panelden yönetilen her şey

`site_settings` **tek satır**, 60 saniyede bir okunuyor, deploy gerekmez.

```sql
-- Bakım modu
update public.site_settings set maintenance_mode = true where id;

-- Header piyasa şeridi kapansın
update public.site_settings set ticker_enabled = false where id;

-- Ana sayfada hangi kategoriler blok olsun
update public.site_settings
   set home_category_slugs = '["asayis","spor","ekonomi","teknoloji"]'
 where id;

-- Reklam alanlarını aç
update public.site_settings set ads_enabled = true where id;
```

**Menü** `nav_items` tablosundan gelir. Etiket dört dilde JSONB;
eksik dil Türkçeye düşer.

```sql
insert into public.nav_items (location, kind, label, target_slug, sort_order)
values ('header', 'category',
        '{"tr":"Sağlık","en":"Health","ar":"صحة","ru":"Здоровье"}',
        'saglik', 70);
```

`location`: `header` · `mobile` · `footer` · `drawer` · `services`

**Kurumsal sayfalar** `pages` tablosunda, gövde dile göre JSONB.
**Reklamlar** `ad_slots`: `home-top`, `home-feed`, `article-mid`, `sidebar`.

---

## Etkileşim — üyelik zorunlu

Yorum ve beğeni için giriş şart (karar böyle verildi). Tablolara
**doğrudan yazma yetkisi kimsede yok**; tek giriş RPC'ler:

| RPC | Kim çağırabilir | Ne denetler |
|---|---|---|
| `post_comment()` | authenticated | uzunluk, saatlik sınır, hesap durumu, onay kuralı |
| `toggle_article_like()` | authenticated | oturum, özellik açık mı |
| `track_article_view()` | anon + authenticated | haber yayında mı, aynı saatte tekrar sayma |
| `subscribe_newsletter()` | anon | e-posta biçimi, IP başına saatlik sınır |

Yorumlar varsayılan `pending`. Türkiye'de haber sitesi yorumu için
moderasyon opsiyonel değil (5651 sayılı kanun) — IP hash ve
user-agent denetim izi olarak saklanıyor.

Görüntülenme sayacı `articles` tablosunda **tutulmuyor**: her
görüntülemede `UPDATE` demek row lock ve ISR önbelleği kirlenmesi
demekti. Olaylar `article_views`'a yazılıyor, sayaçlar
`article_stats`'te toplanıyor.

---

## Hizmetler — her biri ayrı sayfa

| Adres (TR) | EN | İçerik |
|---|---|---|
| `/hizmetler` | `/en/services` | Giriş, kart ızgarası |
| `/hizmetler/hava-durumu` | `weather` | Anlık + 24 saatlik + 6 günlük, şehir seçici |
| `/hizmetler/piyasalar` | `markets` | Tüm semboller, mini grafik |
| `/hizmetler/namaz-vakitleri` | `prayer-times` | 6 vakit, sıradaki vurgulu, şehir seçici |
| `/hizmetler/skorlar` | `scores` | Fikstür, puan durumu, gol krallığı |
| `/hizmetler/nobetci-eczane` | `pharmacy` | İl/ilçe seçimi + "yakınımdakiler" |
| `/hizmetler/trafik` | `traffic` | **Veri kaynağı yok** |

Tek sayfada sekme değil, ayrı adres: paylaşılabilir ve arama
motorlarınca ayrı ayrı indekslenebilir. Alt yollar dört dilde
çevrilir (`serviceSlugs`); başka dilin yazımıyla gelen bağlantı
da kabul edilir.

Şehir seçimi `?city=` ile adreste taşınır — istemci durumu değil,
böylece paylaşılabilir ve sunucuda önbelleklenir.

---

## Yönetim paneli

`/admin` — editör ve yönetici erişir. Yetkisiz kişi ana sayfaya
yönlendirilir, panelin varlığını bile görmez.

| Bölüm | Kim görür | Ne yapar |
|---|---|---|
| Genel bakış | editör + admin | 11 sayaç: bekleyen haber/yorum, okuma, kullanıcı, abone, hatalı medya |
| Haberler | editör + admin | Onay kuyruğu; **onay/red yalnızca admin** |
| Yorumlar | editör + admin | Onayla / reddet / spam |
| Kullanıcılar | **admin** | Rol değiştirme, hesap açma-kapama |
| İstatistik | editör + admin | En çok okunan haberler ve sayfalar |
| Ayarlar | **admin** | Site adı, bakım, kayıt, özellikler, ana sayfa sayıları |
| Sistem | **admin** | Bot ve AI açma-kapama, sağlık göstergeleri |

### Güvenlik

Panel tablolara **doğrudan yazmaz**; her işlem bir RPC'den geçer.
Yetki, doğrulama ve denetim izi tek yerde kalır ve mobil uygulama
da aynı uçları kullanabilir.

Veritabanı iki şeyi garanti eder:

- **Kimse kendi yönetici yetkisini kaldıramaz** — panele giriş
  kalmaz
- **Son yönetici rolden çıkarılamaz**

`admin_update_settings` yalnızca bilinen anahtarları kabul eder;
bilinmeyen anahtar sessizce yok sayılmaz, **hata verir** — yazım
hatası fark edilmeden geçmesin.

Her rol değişikliği, ayar güncellemesi ve bot/AI anahtarı
`admin_log` tablosuna düşer: kim, ne zaman, ne değiştirdi.

### Doğrulanan davranış

```
rol değiştirme               ✓
kendi yetkisini kaldırma     ✓ engellendi
son yönetici çıkarma         ✓ korumalı
bilinmeyen ayar              ✓ reddedildi
yönetici olmayan erişim      ✓ engellendi
admin_users okur için        0 satır
```

---

## Üyelik sistemi

### Kayıt

E-posta + şifre, **Google** ve **Apple**. Kayıt formunda ad,
soyad, şehir, e-posta, şifre.

**Kullanıcı adı otomatik üretilir:** `ahmet.yilmaz@gmail.com` →
`ahmet-yilmaz`. Çakışırsa `-2`, `-3` eklenir. Kullanıcıya
sorulmaz — formu uzatır, çoğu okur umursamaz, sonradan
değiştirilebilir.

Profil satırını **istemci açmaz**: `on_auth_user_created`
trigger'ı `auth.users`'a eklenen her kullanıcı için `profiles`
satırını kendisi açar. Kayıtta ad/soyad/şehir
`raw_user_meta_data` içine yazılır, trigger oradan okur.

### Eksik bilgi tamamlama

Google/Apple şehir bilgisi vermez, adı bazen tek parça gönderir.
Trigger `onboarded_at`i boş bırakır; `/profil-tamamla` ekranı
eksikleri toplar. Panele girmeye çalışan tamamlanmamış kullanıcı
oraya yönlendirilir.

Seçilen şehir aynı zamanda site geneli şehir çerezine yazılır —
hava, namaz ve eczane hemen ona göre çalışır.

### Roller

| Rol | Yapabildiği |
|---|---|
| `reader` | Yorum, beğeni, haber kaydetme |
| `editor` | + Haber ekleme/düzenleme/silme (kendi haberleri) |
| `admin` | + Onaylama, herkesin içeriğini yönetme |

**Editör akışı** (gerçek veriyle test edildi):

```
1. editör ekler   → pending_review, yayında DEĞİL
2. admin onaylar  → published, yayında
3. editör düzenler→ pending_review, yayından KALKAR
4. editör siler   → deleted_at dolar (yumuşak silme)
```

Başkasının haberini düzenleme/silme denemesi engellenir.

### Yorumlar

Cevap verilebilir (`parent_id`). Kullanıcı **yalnızca kendi**
yorumunu siler. Silinen yorum fiziksel olarak kaldırılmaz:
5651 sayılı kanun IP ve zaman kaydını gerektiriyor. Gövde
`[silindi]` olur, durum `deleted` olur.

Cevap yalnızca **onaylanmış** bir yoruma verilebilir — onay
beklemedeki yoruma cevap zinciri kurulamaz.

### Yorumlar — arayüz

Ağaç yapısı: kök yorumlar ve altında girintili cevaplar (sol
kenarda çizgi). Cevap yazarken kime cevap verildiği kutuda
gösterilir, tek dokunuşla vazgeçilir.

**Silme düğmesi yalnızca kendi yorumunda görünür.** `meId`
karşılaştırması sadece düğmeyi göstermek için — yetki kontrolü
`delete_own_comment` içinde, veritabanı tarafında. İstemciyi
atlatan biri yine RPC'ye takılır.

Cevabı olan bir yorum silinirse cevaplar öksüz kalmasın diye
listeden yalnızca o yorum çıkarılır.

### Editör haber formu

`/hesabim/yeni` ve `/hesabim/duzenle/{id}` — dört dilde
(`accountSlugs`). Editör/admin değilse **404**; oturum yoksa
girişe yönlendirir.

**Gövde ham HTML değil, blok dizisi:** `{type, text}`.
`articles.body` jsonb da bu biçimi bekliyor. Ham HTML kabul
etmek XSS kapısı açardı; blok yapısı hem güvenli hem de mobil
uygulamada aynı veriden farklı düzen üretmeye elverişli.

Editörde paragraf/ara başlık ekleme, yukarı-aşağı taşıma,
silme var. Yayındaki bir haberi düzenlerken uyarı çıkar:
kaydedince yayından kalkıp yeniden onaya düşeceği yazılı.

Düzenleme sayfası haberi `articles` tablosundan okur; RLS
yalnızca yazarın ve yöneticinin görmesine izin verdiği için
başkasının haberini açmaya çalışan **404** alır.

### Kullanıcı paneli

`/hesabim` üç sekme: **Kaydettiklerim**, **Yorumlarım**,
**Haberlerim** (yalnızca editör/admin). Her biri `my_saved`,
`my_comments`, `my_articles` görünümlerinden okur; RLS
`auth.uid()` ile sınırlar.

### Kayıt kapatma

`site_settings.registration_enabled = false` → kayıt sayfası
kapanır, mevcut kullanıcılar girmeye devam eder.
`registration_message` ile kendi mesajını yazabilirsin.

### Görüntülenme takibi

| Tablo | Ne izler |
|---|---|
| `article_views` + `article_stats` | Haber okumaları |
| `page_views` + `page_stats` | **Haber dışı** sayfalar: kategori, şehir, hizmet, arama |

`page_views` `platform` alanı taşır (`web` / `ios` / `android`) —
mobil uygulama aynı uçtan yazacak. Aynı oturum + aynı sayfa
saatte bir kez sayılır.

---

## Seçili şehir — site geneli

Hava durumu, namaz vakitleri ve nöbetçi eczane **tek bir şehir
seçimine** bağlıdır. Okur şehri bir kez seçer, üç hizmet birden
ona göre çalışır. Varsayılan **İstanbul**.

Seçim iki yere yazılır:

| Yer | Neden |
|---|---|
| Çerez `kb-city` | Sunucu bileşenleri okuyabilsin (hizmet sayfaları, ana sayfa şeridi) |
| `localStorage` | Çerez temizlenirse seçim kaybolmasın |

Çerez sunucuda doğrulanır: yalnızca `[a-z0-9-]` (en fazla 40
karakter). Bozuk değer gelirse İstanbul'a düşer — test edildi.

Seçici header'daki şehir düğmesiyle ve hizmet sayfası başlığındaki
düğmeyle açılır:

- **Masaüstü:** ortada açılan pencere (460px)
- **Mobil:** alttan kayan tabaka, ekranın **%65'i**, kapanırken
  aşağı iner
- Üstte arama kutusu — 81 il bir listede uzun. Arama `tr`
  yerelinde karşılaştırır, plaka koduyla da bulunur.

Adresteki `?city=` yalnızca paylaşılan bağlantılar için seçimi
geçersiz kılar.

---

## Nöbetçi eczane

Kaynak: **api.nobetecza.com**

```
ECZANE_API_URL=https://api.nobetecza.com
ECZANE_API_KEY=necz_...
```

Şehir site genelindeki seçimden gelir. İkinci mod
**"Yakınımdakiler"**: tarayıcı konumu → kendi API ucumuz →
sağlayıcı. Konum izni düğmeye basılmadan sorulmaz; reddedilirse
şehir modunda kalır — izin vermemek bir hata değil.

**Kart düzeni:** kare (1/1 oran), masaüstünde satırda **üç**,
mobilde **iki**. Kare oran içerikten bağımsız sabit yükseklik
verir; farklı uzunluktaki adresler ızgarayı bozmaz. Ad ve adres
iki satırda kırpılır.

**Renk:** kırmızı (`#E5484D`) — sağlık ve acil çağrışımı. Üstte
ince vurgu şeridi, artı işareti simgesi, kırmızı "Ara" düğmesi.

Her kartta ara / yol tarifi düğmesi, uzaklık rozeti, kademeli
giriş animasyonu.

### Güvenlik

| Önlem | Neden |
|---|---|
| Anahtar yalnızca sunucuda | İstemciye verilirse kotayı başkaları tüketir |
| `safeSlug()` doğrulaması | `il`/`ilce` doğrudan adrese ekleniyor — SSRF ve parametre enjeksiyonu riski |
| Koordinat aralık kontrolü | `lat` −90…90, `lng` −180…180, yarıçap 500 m…50 km |
| IP başına 12 istek/dk | Uç nokta herkese açık; sağlayıcının 100/dk kotası korunmalı |
| `Cache-Control: private` | Konum sonucu kişiye özel, paylaşılan önbelleğe girmemeli |

`safeSlug` yalnızca `[a-z0-9-]` (en fazla 40 karakter) ve 1–81
plaka kodunu kabul eder. 16 saldırı senaryosuyla test edildi:
yol geçişi, SQL denemesi, tam URL, parametre kaçırma, null bayt,
uzun dize — hepsi reddedildi.

Önbellek: nöbet listesi 30 dk, il/ilçe listesi 1 hafta, konum
sonucu 5 dk. Nöbet günde bir değişir; sık istek kotayı boşa
harcardı.

---

## Futbol skorları

Kaynak: **skor.rovand.cloud** (TFF Trendyol Süper Lig verisi).

```
SKOR_API_URL=https://skor.rovand.cloud
SKOR_API_KEY=...
```

**Anahtar sunucuda kalır.** Doküman tarayıcıdan çağrı için
`?api_key=` öneriyor çünkü `X-Api-Key` preflight tetikliyor;
biz sunucudan çağırdığımız için preflight yok, header yöntemi
kullanılıyor ve anahtar tarayıcıya hiç inmiyor.

`type=all` ile tek istek, `revalidate: 300` ile beş dakika
önbellek — IP başına dakikada 60 istek sınırı var ve veri günde
birkaç kez güncelleniyor.

### Ad temizleme

TFF adları büyük harf ve unvanlı geliyor. `cleanTeam()` unvanı
atar, `titleCase()` yazımı düzeltir:

```
GALATASARAY A.Ş.              → Galatasaray
GAZİANTEP FUTBOL KULÜBÜ A.Ş.  → Gaziantep
VICTOR JAMES OSIMHEN          → Victor James Osimhen
BERKAN İSMAİL KUTLU           → Berkan İsmail Kutlu
ANDERSON SOUZA CONCEIÇAO      → Anderson Souza Conceiçao
```

İki tuzak vardı:

- **`\b` sınırı Türkçe harfle çalışmaz.** "Ş" sözcük karakteri
  sayılmadığı için `\bA\.?\s?Ş\.?\b` hiç eşleşmiyor,
  "Galatasaray A.ş." çıkıyordu.
- **Türkçe yerelde "I" → "ı" olur.** Yabancı adlarda yanlış:
  "Osımhen". Ayraç yalnızca **İ Ğ Ş**; Ç/Ü/Ö bilerek dışarıda,
  çünkü Portekizce "Conceição" ve Almanca "Müller" de kullanıyor.

18 kulüp ve 38 oyuncu adının tamamı gerçek yanıtla test edildi.

### ⚠️ Maç tarihi yok — sağlayıcı vermiyor

Fikstür yanıtındaki alanların tamamı:

```
week, home_team, away_team, home_id, away_id,
home_score, away_score, match_id, status
```

**Tarih ya da saat alanı yok.** Bu yüzden "12.09.2026" veya
"Bugün / Yarın" gösterilemiyor; yalnızca hafta numarası var.
Uydurma tarih üretmek yanlış olurdu.

Çözüm sağlayıcı tarafında: fikstüre `date` alanı eklenirse
`sports.ts` içindeki `Match` tipine bir satır, karta bir satır
eklemek yeterli.

Aynı sebeple **canlı durum da yok** (`status` yalnızca
`completed` / `scheduled`):

- **"Bu hafta"** = oynanmamış en küçük hafta
- **Ana sayfa şeridi** = son oynanan haftadan bir maç (skorlu),
  yoksa sıradaki maç

### Puan tablosu

"FORM" başlığı tek başına anlaşılmıyordu — sütun son beş maçın
sonucunu (kazandı / berabere / kaybetti) gösteriyor. Başlık
artık **"Son 5"**; noktaların üzerine gelince hangi sonuç olduğu
yazıyor.

Haftanın ilk oynanmış maçı **daha büyük kartla** vurgulanır:
26px skor, 18px köşe, belirgin kenarlık.

---

## Dış servisler

| Servis | Kaynak | Anahtar |
|---|---|---|
| Hava durumu | Open-Meteo | gerekmez |
| Namaz vakti | Aladhan, method 13 (Diyanet) | gerekmez |
| Döviz / altın / kripto / Brent | Yahoo Finance | gerekmez |
| BIST endeksleri | `borsa-api` paketi | gerekmez |

Haber sayfasında **haberin şehrinin** havası gösterilir; okurun
konumu istenmez.

### Borsa verisi

`borsa-api` (Yahoo Finance üzerinden, gecikmeli) kullanılıyor.
İstemci **süreç başına tek kez** kurulur: her çağrıda yeni örnek
açmak paketin içindeki yahoo-finance2 bildirimini logda tekrar
tekrar bastırıyor ve yedi sembollük şeritte tek istekte yedi
istemci kuruyordu.

İleride lisanslı bir sağlayıcıya geçmek istersen
**`src/lib/markets.ts` içindeki `fetchQuotes` fonksiyonunu
değiştirmen yeterli** — başka hiçbir dosyaya dokunulmaz.

---

## Önbellek ve tazeleme

| Sayfa | `revalidate` |
|---|---|
| Ana sayfa | 60 sn |
| Haber | 300 sn |
| Kategori / şehir | 120 sn |
| Video | 180 sn |
| Hizmetler | 600 sn |
| Kurumsal sayfa | 1 saat |
| Arama, giriş, hesap | önbelleklenmez |

Bot yeni haber yazınca beklemeden tazelemek için:

```bash
curl -X POST https://siten/api/revalidate \
  -H 'content-type: application/json' \
  -d '{"secret":"...","slug":"haberin-slugı"}'
```

Sır **sabit zamanlı** karşılaştırılıyor; normal `!==` ilk farklı
karakterde döner ve zamanlama ölçülerek sır tahmin edilebilir.

---

## Dokploy

**Create Service → Compose**, `docker-compose.yml`.

`NEXT_PUBLIC_*` değişkenleri **derleme anında** gömülür; Dokploy'da
hem Environment hem Build Args olarak girilmeli — `docker-compose.yml`
bunu zaten `args` bloğuyla geçiriyor.

Kaynak sınırı 1.5 CPU / 2 GB. Bot 4 CPU / 5 GB aldığı için sunucuda
diğer projelere yer kalıyor.

---

---

## Tasarımla birebir uyum

Yerleşim `Kuzeybatı Haber.dc.html` prototipinden **birebir** çıkarıldı.
Değiştirilmesi tasarımı bozacak üç nokta:

**1. Tek `max-width` kapsayıcı.** Prototipte header ve footer dahil
SAYFANIN TAMAMI tek bir `max-width:var(--max)` kutusunun içinde;
bölümler kendi `var(--gut)` boşluğunu taşır. Header'ı tam genişlik
yapmak yerleşimi bozar.

**2. Mobil değerler medya sorgusunda.** Prototip mobil/masaüstü
geçişini JavaScript ile (`applyDevice`) yapıyordu. `globals.css`
içindeki `@media (max-width: 860px)` bloğu o fonksiyondaki
değerlerin birebir aynısıdır — `--gut:16px`, `--h1:27px`,
`--hero:300px`, `--side:100%` …

**3. `data-only` sadece GİZLER.** Görünürken elemanın kendi
`display` değerine dokunulmaz. `display:initial` gibi bir kural
flex kutuları satır içine düşürür ve header dağılır.

Diğer birebir davranışlar: `data-feat` ızgaraları mobilde yatay
kaydırmaya döner (220px kart), `data-mob-hide` (En çok okunanlar)
mobilde gizlenir, `data-ticker` RTL'de ters yönde akar.

### Logo eşlemesi

Prototipteki kural: **`white.png` KOYU temada, `darkkk.png` AÇIK
temada** görünür. `logo_light_key` = açık renkli logo (koyu zeminde),
`logo_dark_key` = koyu renkli logo (açık zeminde).

---

## Demo içerik — YAYINDA KAPALI

`site_settings.demo_mode`, **varsayılan `false`**. Kapalıyken site
yalnızca veritabanındaki gerçek içeriği gösterir; içerik yoksa
bölüm hiç render edilmez. Uydurma haber, uydurma borsa fiyatı
veya uydurma skor **yayında asla görünmez**.

```sql
-- Tasarım denemesi / sunum için aç
update public.site_settings set demo_mode = true where id;

-- Yayına dönerken kapat
update public.site_settings set demo_mode = false where id;
```

Tek istisna: `.env` hiç doldurulmamışsa (Supabase yok) demo
otomatik açılır — bu bir geliştirme kolaylığı, arkada veritabanı
olmadığı için gerçek içerik zaten mümkün değil.

Demo açıkken **site eksiksiz gezilir**: ana sayfa, haber detayı,
kategori, şehir, arama, video, hizmetler ve kurumsal sayfalar.

| Boş olan | Yedek |
|---|---|
| `articles` | Prototipteki haberler (`demo-` önekli slug'larla, bağlantıları çalışır) |
| `nav_items` | Anasayfa · Spor · Finans · Kültür · Teknoloji · Video |
| `cities` | İstanbul · Ankara · İzmir · Bursa · Antalya · … |
| `categories` | Gündem, Asayiş, Ekonomi, Spor … (renkleriyle) |
| `pages` | Hakkımızda, Künye, Gizlilik … |
| Borsa / hava / namaz erişilemiyor | Prototipteki değerler |
| Canlı skor, puan durumu | Prototipteki tablo (sağlayıcı seçilmedi) |

**Demo gerçek 404'leri maskelemez.** Açıkken bile `demo-` önekli
olmayan, gerçekten var olmayan bir haber 404 döner.

**Menü ve şehir şeridi ayrıdır.** `nav_items` boşsa varsayılan menü
demo modundan bağımsız gösterilir — bu içerik eksikliği değil
yapılandırma eksikliği; header'ın çıplak kalması hata olur.
Panelden bir kayıt girildiği an devre dışı kalır.

Demo kaynağı: `src/lib/demo.ts`.

---

## Okuma boyutu

Haber sayfasında sesli anlatımın altında, sağa yaslı **A− / A+**
düğmeleri. Etiket ve gösterge yok — iki düğme yeterli.
Dört kademe: `.88 · 1 · 1.14 · 1.3`.

Seçim `localStorage`'a yazılır ve `<html>` üzerinde
`data-read` özniteliği olarak taşınır; CSS `--read-scale`
değişkenini oradan okur. Böylece **tüm haberlerde** aynı boyut
geçerli olur.

Öznitelik `ThemeScript` ile **ilk boyamadan önce** uygulanır —
tema gibi. React state'iyle taşımak her sayfada sıfırlanır ve
ilk karede zıplama yaratırdı.

---

## Piyasa mini grafiği

Yan sütundaki piyasa kutusunda her satırda 62×22px'lik bir
çizgi grafiği var: eksen ve etiket yok, yalnızca yön ve
oynaklık. Veri Yahoo `chart` uç noktasından `interval=1h&range=5d`
ile gelir, 32 noktaya indirgenir.

Gram altın türetilmiş olduğu için iki serinin (XAU, USD/TRY)
noktaları çarpılarak kendi grafiği üretilir.

---

## Ana sayfada kapaksız haber yok

Her kart bir görsel gösterir. `articles.cover_media_id` iki
durumdan birini işaret eder:

| Kaynak | Alan |
|---|---|
| Fotoğraf | `media.storage_key` |
| Video | `media.poster_key` — bot her videoyu işlerken posterini de kaydeder |

**NULL ise haber listeye hiç alınmaz.** Filtre sorgu seviyesinde
(`.not("cover_media_id", "is", null)`): veriyi çekip sonra elemek
hem boşuna bant genişliği hem de "10 istedim 6 geldi" gibi eksik
listeler demekti.

Uygulandığı yerler: hero, öne çıkanlar, son dakika, en çok
okunanlar, kategori blokları, video rayı, şehir sayfası, ilgili
haberler.

> Arama sonuçları bu filtreden **muaf** — okur bir şey arıyorsa
> görselsiz de olsa sonucu görmeli.

### Doğrulanan davranış

| Haber | Kapak | Ana sayfada |
|---|---|---|
| Posterli video | video | **görünür** |
| Postersiz video | — | gizli |
| Medyasız | — | gizli |
| Fotoğraflı | fotoğraf | **görünür** |

Kapak seçim mantığı yedi senaryoyla ayrıca test edildi
(cover_media_id NULL/dolu, video+fotoğraf birlikte, postersiz
video, webp poster uzantısı).

---

## ⚠️ Varyant varsayma — 404'ün kaynağı

Bot kaynaktan **büyük varyant üretmez** (`image-processor.ts`):

```js
if (v.name !== "thumb" && meta.width < v.w * 0.9) {
  const already = variants.some((x) => x.width >= meta.width - 2);
  if (already) continue;          // varyant atlanır
}
```

800px'lik bir video posteri için `poster-full.avif` **hiç
üretilmez**. Site körü körüne `full` isteyince CDN 404 döner ve
kapak boş görünür.

| Kaynak genişliği | Üretilen dosyalar |
|---|---|
| < 445px | `thumb` |
| < 890px | `thumb`, `card` |
| ≥ 890px | `thumb`, `card`, `full` |

`src/lib/media.ts` artık hangi varyantın var olduğunu hesaplar ve
**olmayanı hiç istemez**; istenen yoksa eldeki en büyüğüne düşer.

- **Fotoğraf:** bot ürettiği varyantları `media.variants` içine ad
  ad yazıyor — oradan kesin okunur.
- **Video posteri:** yalnızca kaynak genişliği kayıtlı
  (`variants.poster.w`), o yüzden botun kuralı birebir tekrar
  edilir. Genişlik bilinmiyorsa güvenli taraf: `card`.

`srcset` de yalnızca var olan varyantları listeler — olmayan bir
varyantı listeye koymak tarayıcının 404 indirmesine yol açardı.

> Varyant genişliklerini `bot_settings.image_variants` üzerinden
> değiştirirsen `media.ts` içindeki `VARIANT_W` sabitini de
> güncelle; ikisi aynı olmalı.

---

## Videolu haberin kapağı

Bot her videoyu işlerken posterini de kaydeder:

```
dosya  →  {storage_key}/poster-thumb.avif
          {storage_key}/poster-card.avif
          {storage_key}/poster-full.avif
kolon  →  media.poster_key    = {storage_key}/poster
          media.variants.poster.f = uzantı (image_format ayarı)
```

**Sorun neydi:** `media_sync_article_state` trigger'ı kapağı
yalnızca fotoğraftan seçiyordu (`where m2.type = 'image'`).
Haberin fotoğrafı yok, sadece videosu varsa
`articles.cover_media_id` NULL kalıyor ve kart boş gri kutu
olarak çıkıyordu.

`yama-25` üç şey yapar:

1. Trigger fotoğraf bulamazsa **posteri olan videoyu** kapak yapar
2. Geçmiş haberlere aynı atamayı toplu uygular
3. Posteri hiç üretilmemiş videoları kuyruğa geri alır — bot
   sonraki turda posteri üretir

Posteri olmayan video kapak yapılmaz: dosya yok, kart yine boş
çıkardı. Video rayında poster yoksa gri kutu değil, medyanın
baskın rengiyle bir yüzey gösterilir.

Uzantı sabit `.avif` değil, `media.variants.poster.f` içinden
okunur — `bot_settings.image_format` webp/jpeg'e çevrilirse tüm
posterler 404 olurdu.

Haber sayfasında video oynatılana kadar aynı poster görünür
(`<video poster>`).

---

## Yazı tipi

Site **Yahoo Sans** kullanır. Dosyaları `public/fonts/` klasörüne
at — **adı önemli değil.**

`FontFaces.tsx` klasörü okur ve bulduğu her dosya için `@font-face`
üretir; ağırlık dosya adından çıkarılır (Regular/Rg → 400,
Medium → 500, SemiBold/DemiBold → 600, Bold → 700,
ExtraBold → 800, Black → 900, Italic → italik). Desteklenen
uzantılar: `.woff2` `.woff` `.ttf` `.otf`.

> **Neden böyle:** CSS'e sabit dosya adı yazmak kırılgan. Dosya
> `YahooSans-Regular.ttf` yerine `YahooSans_Rg.otf` olarak
> konursa adres 404 döner ve site sessizce Inter'e düşer.

### ⚠️ Middleware'e dokunurken dikkat

`src/middleware.ts` içindeki `PUBLIC_FILE` deseni **uzantısı olan
her yolu** statik sayar ve dil yönlendirmesinden muaf tutar.

Bir zamanlar burada elle yazılmış bir uzantı listesi vardı ve
`.ttf` içinde yoktu: `/fonts/YahooSans-Regular.ttf` dil
yönlendirmesine girip `/tr/fonts/...` olarak yeniden yazılıyor ve
**404** dönüyordu. Dosyalar klasörde duruyor olmasına rağmen yazı
tipi bir türlü yüklenmiyordu.

`matcher` de `fonts` klasörünü hariç tutar — statik varlıklar
middleware'e hiç uğramaz.

Ağırlık çıkarımı 15 farklı adlandırmayla test edildi. Klasör
boşsa site bozulmaz, Inter kullanılır.

**Hız için:** TTF'leri WOFF2'ye çevir (%40-60 küçülür).
`npx ttf2woff2 < YahooSans-Regular.ttf > YahooSans-Regular.woff2`
— başka ayar gerekmez, site woff2'yi kendiliğinden tercih eder.

---

## Sayfa genişliği

| Alan | Genişlik |
|---|---|
| Gövde içeriği | `max(900px, 70vw)` — ekranın %70'i |
| **Header ve footer** | `--max-head: 100%` — **tam genişlik** |

900px alt sınırı zorunlu: kırılma noktasında (861px) `70vw`
yaklaşık 603px olurdu ve hero + yan sütun düzeni çökerdi.

---

## Kart oranları — dokunma

Kart görselleri **sabit oran** kullanır (16/10, 4/3, 9/16) ve
`object-fit: cover` ile kırpılır.

Bir zamanlar oran medyanın gerçek boyutundan türetiliyordu
(`aspectRatio: ${width} / ${height}`). Dikey bir fotoğraf
(1080×1920) kartı ekran boyu uzatıyor, başlık ve okuma süresi
çok aşağıda kalıyor, düzen patlıyordu. Oranı asla medyadan
türetme.

---

## Kategori sayfaları

Düz haber listesi değil, ana sayfayla aynı düzen mantığı:

```
başlık → MANŞET (ilk 4 haber, kaydırmalı)
       → KATEGORİYE ÖZEL BÖLÜM
       → haber ızgarası + yan sütun
```

Özel bölüm kategori slug'una göre seçilir:

| Kategori | Bölüm |
|---|---|
| `spor`, `futbol` | Haftanın maçları (takım logolu kartlar) + ilk 5 takım, form noktalarıyla |
| `ekonomi`, `finans`, `borsa` | Piyasa kartları, her birinde mini grafik |
| `saglik` | Seçili şehrin nöbetçi eczaneleri + "Ara" düğmesi |
| diğerleri | Yok — zorlama widget sayfayı gürültüye boğar |

Bölüm `Suspense` içinde: dış servis yavaşsa sayfanın geri kalanı
beklemez. Veri gelmezse bölüm hiç basılmaz, sayfa sağlam kalır.

---

## Ana sayfada tekrar yok

Aynı haber sayfada iki kez görünmez. `takeUnique()` her bölümde
daha önce kullanılan kimlikleri eler; sıra şu:

```
hero → öne çıkanlar → şerit videosu → video rayı
     → kategori blokları → Sana Özel akışı
```

### ⚠️ takeUnique'e giren liste FAZLADAN çekilmeli

Tekrar engeli üstteki bölümlerde kullanılan haberleri eler. Liste
tam istenen sayıda çekilirse elemeden sonra elde çok az kalır —
"öne çıkanlar" 6 karttan **1 tanesine**, video rayı 10'dan 6'ya
düşmüştü.

| Bölüm | Çekilen |
|---|---|
| Hero | `home_hero_count × 3` |
| Öne çıkanlar | `home_featured_count × 5` |
| Video rayı | `(home_video_count + 1) × 3` |
| Kategori bloğu | `home_category_count × 3` |
| Akış | `home_feed_count × 2` |

Fazlası atılır, eksik kalmaz. Yeni bir bölüm eklerken bu kurala
uy.

**"En çok okunanlar" bu kuraldan muaftır** — orası bir sıralama,
içerik bloğu değil; manşetteki haberin listede de olması doğaldır.

**Hero'da medyasız haber olmaz:** sorgu `cover_media_id` ya da
`has_video` şartı arar. Kapağı olmayan haber orada boş gri kutu
olarak çıkardı.

---

## Ana sayfa üst düzeni

```
[ hizmet şeridi: piyasa · namaz · video · canlı skor ]
[ HERO (2/3) ....................... | hava paneli   ]
[ hero altı 3 kart ................. | reklam        ]
                                     | en çok okunan ]
[ video rayı — 10 kart, yatay kaydırılır ]
[ Asayiş / Ekonomi / Spor / Sağlık — 8'er kart, yatay ]
[ Sana Özel akışı ]
```

**Hero'da özet gösterilmez** — yalnızca kaynak künyesi ve başlık.
Özet hem görseli boğuyordu hem de mobilde başlığı aşağı itiyordu.
Nokta göstergesi de kaldırıldı; sağ üstte `1 / 3` sayacı ve
duraklat düğmesi, sağ altta önceki / sonraki okları var.
6 saniyede bir otomatik geçer; fareyle üstüne gelince ya da
duraklat düğmesiyle durur.

### Video rayı

10 kart, yatay kaydırılır. Kart genişliği
`clamp(128px, 14vw, 162px)` — masaüstünde 4-5 tanesi yan yana
görünür. Mobilde `calc((100vw - kenar - boşluk) / 3)` ile tam
üç kart sığar.

Başlık kartın altında değil **videonun içinde altta**, koyu
geçiş üstünde; en fazla üç satır, taşarsa `…`. Sol üstte oynat
simgesi, sağ üstte süre rozeti.

Buraya yalnızca **gerçekten videosu olan** haberler gelir —
sorgu `articles.has_video` bayrağını kullanır.

### Kategori rayları

Her blokta 8 haber, yatay kaydırılır. Sayı panelden:
`site_settings.home_category_count` (varsayılan 8),
video sayısı `home_video_count` (varsayılan 10).

## Sana Özel görünüm anahtarı

Ölçüler verilen işaretlemenin birebir karşılığı: kap 34×96,
köşe 24, düğme 28×44, kayan taş sol 3 ↔ 49, geçiş 300ms
ease-in-out. `role="radiogroup"` + `role="radio"` ile
erişilebilir.

---

## Medya davranışı

### Haber sayfası medya sırası

```
başlık → künye → KAPAK → sesli anlatım → AI özeti → GÖVDE
      → etiketler → DİĞER VİDEOLAR → DİĞER GÖRSELLER → reklam → yorumlar
```

Ek medya bilinçli olarak **en altta**: kapağın hemen altına koymak
metni geciktiriyordu. Okur önce haberi okur, arşive sonra bakar.

**Haberde video varsa ilk video KAPAĞA geçer** ve sessiz oynar;
kapak fotoğrafı gösterilmez. Aynı videoyu aşağıda tekrar basmak
gereksiz olurdu — alt bölüm 2. videodan itibaren listeler.

| Yer | Davranış |
|---|---|
| Video varsa kapak | **Videonun kendisi**, sessiz oynar |
| Video yoksa kapak | Fotoğraf; tıklayınca **galeri** açılır |
| Medya açıklaması | Kapağın altında **görünmez** — yalnızca galeride |
| Diğer videolar | Kart olarak dizilmez, **tam genişlik** |
| Videoya tıklama | Sesi açar, **kaldığı yerden** devam eder |
| Tam ekrana geçiş | Ses **otomatik açılır** |
| Ekrandan tamamen çıkma | **Sağ altta küçük oynatıcı** (masaüstü 300px, mobil 190px) |
| Bir pikseli bile görünüyorsa | Küçük oynatıcı çıkmaz |
| Galeri açılması | Arkadaki video **susar** |
| İki oynatıcı | Biri başlayınca diğeri durur |

### Oynatıcı (`VideoPlayer.tsx`)

Tarayıcının kendi kontrolleri kullanılmıyor: her tarayıcıda farklı
görünür ve tasarımla uyuşmaz.

- Doğru ikonlar: oynat / **duraklat**, **tam ekran / tam ekrandan çık**,
  ses seviyesine göre değişen hoparlör (yüksek / düşük / sessiz)
- **Kutunun yüksekliği her zaman bellidir** (`aspect-ratio: 16/9`).
  Eskiden `height:100%` yüksekliği olmayan bir kabın içindeydi;
  kutu çöküyor, kontroller birbirine giriyor ve alttaki açıklama
  videonun üstüne biniyordu.
- İlerleme çubuğu `setPointerCapture` kullanır ve süreyi doğrudan
  `el.duration`'dan okur — metadata gelmeden `duration` state'i
  boş olduğu için tıklama hiç işlemiyordu.
- Yüklenirken dönen gösterge; kontroller sabit yükseklikte kalır
- Tampon (buffer) göstergesi, sürüklerken kalınlaşan çubuk
- Klavye: boşluk/k oynat · ←→ 5 sn · m sessiz · f tam ekran
- Ses kaydırıcısı 520px altında gizlenir — dar kutuda yer kaplıyordu

### Küçük oynatıcı — dikkat

Mini moddayken kutuya **hiçbir inline ölçü verilmez**; tüm ölçü
`.kb-mini` sınıfından gelir. Bir zamanlar inline `width:100%`
sınıftaki genişliği eziyordu ve küçük oynatıcı tüm ekranı
kaplıyordu. Inline stil sınıftan güçlüdür — bu satırlara dokunma.

### Galeri (`Gallery.tsx`)

- Yuvarlak köşeli medya (16px) ve gölge
- Video kutusunun genişliği **kalan yüksekliğe göre** sınırlanır:
  `min(100%, 1100px, calc((100dvh - 240px) * 16 / 9))`. Böylece
  kontroller açıklamanın ve küçük resim şeridinin altında kalmaz.
- Açıklama her zaman ortalı, en fazla 760px
- Küçük resim şeridi `width:max-content` + `margin-inline:auto` ile
  ortalanır; taşınca kaydırılır. Yalnızca `justify-content:center`
  kullanmak, taşma olduğunda ilk öğeleri erişilemez yapıyordu.
- Aktif küçük resimde beyaz çerçeve, otomatik görünür alana kaydırma
- Parmakla sağa/sola kaydırma, ok tuşları, Esc
- Alt boşlukta `env(safe-area-inset-bottom)` — iPhone çentiği

---

## Paylaşım

Masaüstünde **ortada açılan pencere**, mobilde **alttan kayan
tabaka** — tek bileşen, konumu medya sorgusuyla değişiyor.
WhatsApp · X · Telegram · Facebook · E-posta · Linki kopyala.

`navigator.share` bilinçli olarak kullanılmıyor: işletim
sisteminin tabakasını açardı ve her platformda farklı görünürdü.

---

## Sana Özel akışı

İki görünüm, sağdaki anahtarla değişir; seçim `localStorage`'a
yazılır ve sonraki ziyarette hatırlanır.

| Görünüm | Ne gösterir |
|---|---|
| **Kart** (varsayılan) | Kaynak künyesi + 16:9 görsel + kategori çipi + başlık + **tek satır** özet + AI kutusu + yorum/okuma süresi/zaman |
| **Liste** | Solda 4:3 küçük görsel, sağda renkli kategori + başlık + kaynak logosu / okuma süresi |

Liste görünümünde başlık üzerine gelince altı çizilir. Mobilde
küçük görsel 150px'ten 104px'e iner (`--fy-thumb`).

**AI özeti kutusu:** haberin `article_ai.ozet` değeri varsa
açıklamanın altında mor vurgulu bir kutu çıkar — kıvılcım
simgesi, "Kısaca" başlığı, iki satıra kırpılmış madde ve
"Devamı" bağlantısı. Renkler `--ai-fg/--ai-bg/--ai-bd`
değişkenlerinden gelir ve açık temada koyulaşır.

Kart görünümündeki özet **tek satıra** sınırlıdır: başlıkla AI
kutusu arasında kısa bir bağlam yeterli, uzun özet ikisini de
boğuyordu.

### Görünüm anahtarının yeri

Başlık satırı **sayfanın tamamını** kaplar; anahtar en sağda,
yan sütunun (bülten) tam üstünde hizalanır. Bunun için yan sütun
`ForYou`'ya `sidebar` prop'u olarak geçilir — sunucu bileşeni
istemci bileşenine çocuk olarak verilebiliyor. Anahtar akış
sütununun içinde kalsaydı sayfanın ortasında duruyordu.

### Kaydırdıkça yükleme

Sayfa sonuna yaklaşınca **10 haber daha** gelir, tavan **50**.
`IntersectionObserver` kullanılır (kaydırma olayı değil): her
pikselde tetiklenmez, nöbetçi eleman 600px kala görününce
çalışır.

Yükleme sırasında **iskeletler** gösterilir; ölçüleri gerçek
kartla aynı olduğu için sayfa zıplamaz ve okur kaydırdığı yeri
kaybetmez. Kart görünümünde künye + 16:9 görsel + iki satır
başlık + özet + AI kutusu; liste görünümünde üç satır.

Uç nokta: `GET /api/feed?locale=tr&offset=10`. Tam `Article`
nesnesi değil, yalnızca kartın çizdiği alanlar döner.

---

## Hız

| Ne yapıldı | Kazanç |
|---|---|
| Kartlarda `thumb` (400px) varyantı | Eskiden 800px `card` iniyordu — kart ~264px, dörtte bir bant genişliği |
| `attachCovers` yalnızca kapağı çeker | 12 haberlik listede 60+ medya satırı yerine 12 |
| Kategori blokları paralel sorgu | 8 sıralı tur yerine tek turda |
| Demo görselleri boyuta göre | Kartlar 900px yerine 400px ister |
| **Liste sorguları gövdeyi indirmez** | `LIST_COLS` gövdeyi hariç tutar; okuma süresi tek tam sayı olarak gelir |
| **Kategori/video tek sorguda** | 600 UUID'lik `IN` listesi yerine dizi eşleşmesi ve bayrak |

### Kategori blokları neden boştu

Site önce `article_categories`'den yüzlerce `article_id` çekip
sonra `.in("id", [600 uuid])` ile haberleri istiyordu. 600 UUID
≈ **22 KB'lık sorgu dizesi**; PostgREST bunu `414 Request-URI Too
Long` ile reddediyor, hata yakalanınca liste boş dönüyordu.

`yama-22` bunu kalıcı çözer: `articles.category_slugs` dizisi
(GIN index) ve `articles.has_video` bayrağı. Tek sorgu, kısa URL.
Diziyi trigger güncel tutar, kategori adı değişirse de tazeler.

### Okuma süresi neden hep "1 dakika"ydı

Süre ÖZETTEN hesaplanıyordu; özet 1-2 cümle olduğu için sonuç hep
1 çıkıyordu. Gövdeyi listelere taşımak ise her kart için
kilobaytlarca metin indirmek demekti.

`articles.reading_minutes` üretilmiş kolonu gövdeden bir kez
hesaplanır (dakikada ~200 kelime), listeye tek tam sayı iner.
Kod tarafında `articleMinutes()` önce bu kolonu okur.

### Kategori eşleştirmesi

Eşleştirme ham metnin tam eşleşmesine bakıyordu: sağlayıcı
`ASAYİŞ` yerine `ASAYIS` gönderdiğinde eşleşme kaçıyor ve haber
`genel`'e düşüyordu. Artık tam eşleşme tutmazsa slugify edilmiş
hâliyle önce mevcut eşleştirmelere, sonra kategori slug'ına
bakılır — Türkçe İ/I, boşluk ve noktalama farkları kategori
kaybına yol açmaz.

Ölçüm (demo modu, yerel): ana sayfa **29 KB gzip**, sunucu yanıtı
**7 ms**, ilk yükleme JS **182 KB**.

Tüm ikonlar **HugeIcons** (hugeicons.com). Emoji kullanılmıyor —
emoji her işletim sisteminde farklı çizilir, tema rengini almaz ve
boyutu kontrol edilemez. Hava durumu simgeleri dahil her şey
`src/components/ui/Icon.tsx` üzerinden geçer; ikon değiştirmek
tek satırlık iş.

---

## Henüz yok

- Canlı skor / puan durumu **gerçek** verisi — sağlayıcı seçilmedi
  (tablo ve şerit demo veriyle çalışıyor)
- Sesli anlatım (TTS) — `tts_enabled` bayrağı hazır, motor seçilmedi
- Yönetim paneli — ayrı uygulama, DB tarafı (view'ler + RPC'ler) hazır
- Bülten gönderimi — abone toplama çalışıyor, gönderim servisi yok
  (çift onay e-postası için `confirm_token` üretiliyor)
